import { DddError, Reader } from './bytes';
import { toMin, type Activity, type Segment } from './timeline';

/*
 * Lecture d'un fichier de téléchargement de carte conducteur (.DDD, .C1B, .TGD, .ESM).
 *
 * Le fichier est une suite d'enregistrements [identifiant 2 octets][annexe 1 octet][longueur 2 octets][données] :
 * annexe 00 = données de 1re génération, 01 = leur signature, 02 = données de 2e génération, 03 = leur signature.
 * Une carte de 2e génération contient les deux jeux de données : on lit les deux et on les fusionne.
 */

export interface DailyRecord {
  /** Jour UTC (minuit) de l'enregistrement. */
  date: Date;
  presence?: number;
  distance: number;
  changes: { minute: number; activity: Activity; slot: 0 | 1; crew: boolean; inserted: boolean; manual: boolean }[];
}

export interface VehicleUse {
  firstUse?: Date;
  lastUse?: Date;
  odometerBegin: number;
  odometerEnd: number;
  nation: number;
  plate: string;
  vin?: string;
}

export interface Place {
  time?: Date;
  entryType: number;
  country: number;
  region: number;
  odometer: number;
  lat?: number;
  lon?: number;
}

export interface CardEvent {
  type: number;
  begin?: Date;
  end?: Date;
  nation: number;
  plate: string;
}

export interface Control {
  type: number;
  time?: Date;
  cardNation: number;
  cardNumber: string;
  nation: number;
  plate: string;
  periodBegin?: Date;
  periodEnd?: Date;
}

export interface BorderCrossing {
  countryLeft: number;
  countryEntered: number;
  time?: Date;
  odometer: number;
}

export interface DriverCard {
  generation: 1 | 2;
  /** Carte intelligente de 2e version (structure 01 01). */
  version2: boolean;
  cardNation: number;
  cardNumber: string;
  authority: string;
  issueDate?: Date;
  validFrom?: Date;
  expiry?: Date;
  surname: string;
  firstNames: string;
  birthDate?: string;
  language: string;
  licence?: { authority: string; nation: number; number: string };
  lastDownload?: Date;
  currentVehicle?: { since?: Date; nation: number; plate: string };
  days: DailyRecord[];
  vehicles: VehicleUse[];
  places: Place[];
  events: CardEvent[];
  faults: CardEvent[];
  controls: Control[];
  conditions: { time?: Date; type: number }[];
  borderCrossings: BorderCrossing[];
  /** Nombre de blocs signés présents dans le fichier (la signature n'est pas vérifiée). */
  signatures: number;
  warnings: string[];
}

interface Ef {
  fid: number;
  data: Uint8Array;
}

/** Découpe le fichier en fichiers élémentaires, rangés par génération. */
export function splitEfs(buf: Uint8Array): { g1: Map<number, Ef>; g2: Map<number, Ef>; signatures: number } {
  if (buf.length < 5) throw new DddError('Fichier vide ou trop court.');
  if (buf[0] === 0x76) {
    throw new DddError('Ce fichier provient de la mémoire d’un véhicule (unité embarquée), pas d’une carte conducteur. Seuls les fichiers de carte conducteur sont lus pour l’instant.');
  }
  const g1 = new Map<number, Ef>();
  const g2 = new Map<number, Ef>();
  let signatures = 0;
  const r = new Reader(buf);
  while (r.remaining >= 5) {
    const start = r.pos;
    const fid = r.u16();
    const app = r.u8();
    const len = r.u16();
    // Remplissage final (00 ou FF) : fin des données utiles.
    if ((fid === 0 && app === 0 && len === 0) || (fid === 0xffff && app === 0xff)) break;
    if (app > 3 || len === 0xffff || len > r.remaining) {
      if (!g1.size && !g2.size) throw new DddError('Ce fichier n’a pas la structure d’un téléchargement de carte conducteur (.DDD).');
      throw new DddError(`Fichier tronqué ou abîmé à la position ${start}.`);
    }
    const data = r.bytes(len);
    if (app === 1 || app === 3) signatures++;
    else (app === 2 ? g2 : g1).set(fid, { fid, data });
  }
  if (!g1.has(0x0520) && !g2.has(0x0520)) {
    throw new DddError('Aucune identification de carte conducteur dans ce fichier : ce n’est pas un téléchargement de carte conducteur, ou il est incomplet.');
  }
  return { g1, g2, signatures };
}

const reader = (ef: Ef | undefined) => (ef ? new Reader(ef.data) : undefined);

function decodeChange(v: number) {
  const slot = ((v >> 15) & 1) as 0 | 1;
  const c = (v >> 14) & 1;
  const notInserted = (v >> 13) & 1;
  const aa = (v >> 11) & 3;
  const minute = v & 0x7ff;
  const known: Activity = (['rest', 'available', 'work', 'driving'] as const)[aa];
  if (!notInserted) return { minute, activity: known, slot, crew: c === 1, inserted: true, manual: false };
  // Carte non insérée : c = 0 → activité inconnue ; c = 1 → activité saisie manuellement.
  return { minute, activity: c ? known : ('unknown' as Activity), slot, crew: false, inserted: false, manual: c === 1 };
}

/** Parcourt le tampon circulaire des activités, du plus récent au plus ancien. */
export function readActivities(data: Uint8Array, warnings: string[]): DailyRecord[] {
  if (data.length < 4) return [];
  const head = new Reader(data);
  const oldest = head.u16();
  const newest = head.u16();
  const L = data.length - 4;
  if (L <= 0) return [];
  const at = (i: number) => data[4 + (((i % L) + L) % L)];
  const u16 = (i: number) => (at(i) << 8) | at(i + 1);
  const u32 = (i: number) => at(i) * 0x1000000 + ((at(i + 1) << 16) | (at(i + 2) << 8) | at(i + 3));

  const out: DailyRecord[] = [];
  let pos = newest;
  let guard = 0;
  let expectedLen: number | undefined;
  while (guard++ < 2000) {
    const prevLen = u16(pos);
    const len = u16(pos + 2);
    if (len < 12 || (len - 12) % 2 !== 0 || (len - 12) / 2 > 1440 || len >= L) {
      if (out.length === 0 && (len === 0 || len === 0xffff)) return [];
      warnings.push('Enregistrement d’activité illisible : les journées plus anciennes sont ignorées.');
      break;
    }
    if (expectedLen !== undefined && len !== expectedLen) warnings.push('Chaînage des enregistrements d’activité incohérent.');
    const seconds = u32(pos + 4);
    const presenceRaw = u16(pos + 8);
    const presenceHex = presenceRaw.toString(16).padStart(4, '0');
    const distance = u16(pos + 10);
    const changes = [];
    for (let k = 0; k < (len - 12) / 2; k++) changes.push(decodeChange(u16(pos + 12 + 2 * k)));
    if (seconds && seconds !== 0xffffffff) {
      out.push({ date: new Date(seconds * 1000), presence: /^\d{4}$/.test(presenceHex) ? Number(presenceHex) : undefined, distance, changes });
    }
    if (pos === oldest || prevLen === 0) break;
    if (prevLen >= L) {
      warnings.push('Longueur d’enregistrement précédent invalide : les journées plus anciennes sont ignorées.');
      break;
    }
    expectedLen = prevLen;
    pos = (((pos - prevLen) % L) + L) % L;
  }
  return out.reverse();
}

/** Enregistrements de taille fixe d'un tampon circulaire, du plus ancien au plus récent. */
function cyclic(r: Reader, pointerSize: 1 | 2, recordSize: number): Reader[] {
  const ptr = pointerSize === 1 ? r.u8() : r.u16();
  const n = Math.floor(r.remaining / recordSize);
  const recs: Reader[] = [];
  for (let i = 0; i < n; i++) recs.push(r.sub(recordSize));
  if (!n) return [];
  const order: Reader[] = [];
  for (let k = 1; k <= n; k++) order.push(recs[(ptr + k) % n]);
  return order.filter((x) => x.buf.subarray(x.pos, x.end).some((b) => b !== 0 && b !== 0xff));
}

function readVehicles(ef: Ef | undefined, gen: 1 | 2): VehicleUse[] {
  const r = reader(ef);
  if (!r) return [];
  return cyclic(r, 2, gen === 2 ? 48 : 31).map((v) => {
    const rec: VehicleUse = {
      odometerBegin: v.u24(),
      odometerEnd: v.u24(),
      firstUse: v.time(),
      lastUse: v.time(),
      nation: v.u8(),
      plate: v.text(13),
    };
    v.skip(2);
    if (gen === 2) rec.vin = v.ia5(17);
    return rec;
  }).filter((v) => v.firstUse);
}

function geo(r: Reader): { lat?: number; lon?: number } {
  const s24 = (x: number) => (x & 0x800000 ? x - 0x1000000 : x);
  const lat = r.u24();
  const lon = r.u24();
  if (lat === 0x7fffff || lon === 0x7fffff) return {};
  // ±DDMM.M × 10 → degrés décimaux
  const conv = (v: number) => {
    const n = s24(v) / 10;
    const sign = n < 0 ? -1 : 1;
    const a = Math.abs(n);
    const deg = Math.floor(a / 100);
    return sign * (deg + (a - deg * 100) / 60);
  };
  return { lat: conv(lat), lon: conv(lon) };
}

function readPlaces(ef: Ef | undefined, gen: 1 | 2): Place[] {
  const r = reader(ef);
  if (!r) return [];
  return cyclic(r, gen === 2 ? 2 : 1, gen === 2 ? 21 : 10).map((p) => {
    const place: Place = { time: p.time(), entryType: p.u8(), country: p.u8(), region: p.u8(), odometer: p.u24() };
    if (gen === 2) {
      p.skip(5); // horodatage et précision du relevé GNSS
      Object.assign(place, geo(p));
    }
    return place;
  }).filter((p) => p.time);
}

function readEvents(ef: Ef | undefined): CardEvent[] {
  const r = reader(ef);
  if (!r) return [];
  const out: CardEvent[] = [];
  while (r.remaining >= 24) {
    const e = r.sub(24);
    const ev: CardEvent = { type: e.u8(), begin: e.time(), end: e.time(), nation: e.u8(), plate: e.text(13) };
    if (ev.begin) out.push(ev);
  }
  return out.sort((a, b) => +a.begin! - +b.begin!);
}

function readControl(ef: Ef | undefined): Control[] {
  const r = reader(ef);
  if (!r || r.remaining < 46) return [];
  const c: Control = {
    type: r.u8(),
    time: r.time(),
    cardNation: (r.skip(1), r.u8()),
    cardNumber: r.ia5(16),
    nation: r.u8(),
    plate: r.text(13),
    periodBegin: r.time(),
    periodEnd: r.time(),
  };
  return c.time ? [c] : [];
}

function readConditions(ef: Ef | undefined, gen: 1 | 2) {
  const r = reader(ef);
  if (!r) return [];
  const recs = gen === 2 ? cyclic(r, 2, 5) : (() => {
    const list: Reader[] = [];
    while (r.remaining >= 5) list.push(r.sub(5));
    return list;
  })();
  return recs.map((c) => ({ time: c.time(), type: c.u8() })).filter((c) => c.time && c.type);
}

function readBorders(ef: Ef | undefined): BorderCrossing[] {
  const r = reader(ef);
  if (!r) return [];
  return cyclic(r, 2, 17).map((b) => {
    const countryLeft = b.u8();
    const countryEntered = b.u8();
    const time = b.time();
    b.skip(8); // précision, coordonnées, statut d'authentification
    return { countryLeft, countryEntered, time, odometer: b.u24() };
  }).filter((b) => b.time);
}

/** Fusionne deux listes en écartant les doublons (même clé). */
function merge<T>(a: T[], b: T[], key: (x: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const x of [...a, ...b]) seen.set(key(x), x);
  return [...seen.values()];
}

export function readCard(buf: Uint8Array): DriverCard {
  const { g1, g2, signatures } = splitEfs(buf);
  const warnings: string[] = [];
  const gen: 1 | 2 = g2.size ? 2 : 1;
  const main = gen === 2 ? g2 : g1;

  const app = reader(main.get(0x0501));
  let version2 = false;
  if (app) {
    app.skip(1);
    const structure = app.u16();
    version2 = structure === 0x0101;
  }

  const id = reader(main.get(0x0520) ?? g1.get(0x0520))!;
  const card: DriverCard = {
    generation: gen,
    version2,
    cardNation: id.u8(),
    cardNumber: id.ia5(16),
    authority: id.text(35),
    issueDate: id.time(),
    validFrom: id.time(),
    expiry: id.time(),
    surname: id.text(35),
    firstNames: id.text(35),
    birthDate: id.datef(),
    language: id.ia5(2),
    days: [],
    vehicles: [],
    places: [],
    events: [],
    faults: [],
    controls: [],
    conditions: [],
    borderCrossings: [],
    signatures,
    warnings,
  };

  const lic = reader(main.get(0x0521) ?? g1.get(0x0521));
  if (lic && lic.remaining >= 53) card.licence = { authority: lic.text(35), nation: lic.u8(), number: lic.ia5(16) };

  const dl = reader(main.get(0x050e) ?? g1.get(0x050e));
  if (dl && dl.remaining >= 4) card.lastDownload = dl.time();

  const cu = reader(main.get(0x0507) ?? g1.get(0x0507));
  if (cu && cu.remaining >= 19) {
    const since = cu.time();
    const nation = cu.u8();
    const plate = cu.text(13);
    if (since || plate) card.currentVehicle = { since, nation, plate };
  }

  // Activités : les deux générations. Pour un même jour, on garde l'enregistrement le plus complet
  // (à égalité, celui de 2e génération) : un appareil de 1re génération n'écrit que dans le premier jeu.
  const byDay = new Map<string, DailyRecord>();
  for (const map of [g1, g2]) {
    const ef = map.get(0x0504);
    if (!ef) continue;
    for (const d of readActivities(ef.data, warnings)) {
      const key = d.date.toISOString().slice(0, 10);
      const prev = byDay.get(key);
      if (!prev || d.changes.length >= prev.changes.length) byDay.set(key, d);
    }
  }
  card.days = [...byDay.values()].sort((a, b) => +a.date - +b.date);

  card.vehicles = merge(readVehicles(g1.get(0x0505), 1), readVehicles(g2.get(0x0505), 2), (v) => `${+v.firstUse!}|${v.plate}`)
    .sort((a, b) => +a.firstUse! - +b.firstUse!);
  card.places = merge(readPlaces(g1.get(0x0506), 1), readPlaces(g2.get(0x0506), 2), (p) => `${+p.time!}|${p.entryType}`)
    .sort((a, b) => +a.time! - +b.time!);
  const evKey = (e: CardEvent) => `${e.type}|${+e.begin!}`;
  card.events = merge(readEvents(g1.get(0x0502)), readEvents(g2.get(0x0502)), evKey).sort((a, b) => +a.begin! - +b.begin!);
  card.faults = merge(readEvents(g1.get(0x0503)), readEvents(g2.get(0x0503)), evKey).sort((a, b) => +a.begin! - +b.begin!);
  card.controls = merge(readControl(g1.get(0x0508)), readControl(g2.get(0x0508)), (c) => String(+c.time!));
  card.conditions = merge(readConditions(g1.get(0x0522), 1), readConditions(g2.get(0x0522), 2), (c) => `${+c.time!}|${c.type}`)
    .sort((a, b) => +a.time! - +b.time!);
  card.borderCrossings = readBorders(g2.get(0x0528));
  if (!card.days.length) warnings.push('Aucune activité enregistrée sur cette carte.');
  return card;
}

/** Chronologie des activités de la carte (segments en minutes UTC). */
export function cardSegments(card: DriverCard, now = new Date()): Segment[] {
  const segs: Segment[] = [];
  const nowMin = toMin(now);
  for (const d of card.days) {
    const base = Math.floor(+d.date / 60_000 / 1440) * 1440;
    const ch = d.changes.filter((c) => c.minute < 1440).sort((a, b) => a.minute - b.minute);
    ch.forEach((c, i) => {
      const start = base + c.minute;
      let end = base + (i + 1 < ch.length ? ch[i + 1].minute : 1440);
      if (end > nowMin) end = Math.max(start, nowMin);
      if (end > start) segs.push({ start, end, activity: c.activity, crew: c.crew, inserted: c.inserted, slot: c.slot });
    });
  }
  return segs;
}

export const fullName = (c: DriverCard) => [c.firstNames, c.surname].filter(Boolean).join(' ');
