import { DddError, Reader } from './bytes';
import type { Activity, Segment } from './timeline';

/*
 * Lecture d'un téléchargement d'unité embarquée (mémoire du chronotachygraphe du véhicule).
 *
 * Le fichier est une suite de transferts « 0x76 TREP données », sans longueur : on lit chaque
 * structure jusqu'au bout. 1re génération : TREP 01 à 05, structures fixes terminées par une
 * signature de 128 octets. 2e génération : TREP 21 à 25 (V1) et 31 à 35 (V2, vitesse en 24), faits
 * de tableaux d'enregistrements [type 1][taille 2][nombre 2][enregistrements].
 */

export interface CardRef {
  type: number;
  nation: number;
  number: string;
}

export interface CardSession {
  surname: string;
  firstNames: string;
  card: CardRef;
  expiry?: string;
  inserted?: Date;
  withdrawn?: Date;
  odometerIn: number;
  odometerOut: number;
  /** 0 conducteur, 1 deuxième conducteur. */
  slot: number;
  manualInput: boolean;
}

export interface VuChange {
  minute: number;
  slot: 0 | 1;
  crew: boolean;
  inserted: boolean;
  activity: Activity;
}

export interface VuPlace {
  card: CardRef;
  time?: Date;
  entryType: number;
  country: number;
  odometer: number;
}

export interface VuDay {
  date: Date;
  odometer: number;
  sessions: CardSession[];
  changes: VuChange[];
  places: VuPlace[];
  conditions: { time?: Date; type: number }[];
}

export interface VuEvent {
  type: number;
  purpose: number;
  begin?: Date;
  end?: Date;
  card: CardRef;
  similar?: number;
}

export interface Overspeed {
  type: number;
  begin?: Date;
  end?: Date;
  max: number;
  avg: number;
  card: CardRef;
}

export interface Calibration {
  purpose: number;
  workshop: string;
  card: CardRef;
  vin: string;
  plate: string;
  w: number;
  k: number;
  l: number;
  tyre: string;
  authorisedSpeed: number;
  oldOdometer: number;
  newOdometer: number;
  oldTime?: Date;
  newTime?: Date;
  next?: Date;
}

export interface VuFile {
  generation: 1 | 2;
  version2: boolean;
  vin: string;
  nation: number;
  plate: string;
  currentTime?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  slots?: { driver: number; codriver: number };
  downloads: { time?: Date; card: CardRef; company: string }[];
  locks: { lockIn?: Date; lockOut?: Date; company: string; address: string; card: CardRef }[];
  controls: { type: number; time?: Date; card: CardRef; begin?: Date; end?: Date }[];
  days: VuDay[];
  faults: VuEvent[];
  events: VuEvent[];
  overspeedControl?: { lastControl?: Date; firstSince?: Date; countSince: number };
  overspeeds: Overspeed[];
  timeAdjustments: { oldTime?: Date; newTime?: Date; workshop: string; card: CardRef }[];
  /** Vitesse détaillée : une minute par bloc, 60 valeurs en km/h. */
  speedBlocks: { begin: Date; speeds: number[] }[];
  identification?: { manufacturer: string; partNumber: string; serial: number; software: string; manufactured?: Date; approval: string };
  sensor?: { serial: number; approval: string; paired?: Date };
  calibrations: Calibration[];
  transfers: number;
  warnings: string[];
}

/* ---- Types de base ---- */

function cardRef(r: Reader, withGeneration: boolean): CardRef {
  const ref = { type: r.u8(), nation: r.u8(), number: r.ia5(16) };
  if (withGeneration) r.skip(1);
  if (ref.type === 0 || ref.type === 0xff) return { type: 0, nation: 0, number: '' };
  return ref;
}

const plateOf = (r: Reader) => ({ nation: r.u8(), plate: r.text(13) });
const changeOf = (v: number): VuChange => ({
  minute: v & 0x7ff,
  slot: ((v >> 15) & 1) as 0 | 1,
  crew: ((v >> 13) & 1) === 0 && ((v >> 14) & 1) === 1,
  inserted: ((v >> 13) & 1) === 0,
  activity: (['rest', 'available', 'work', 'driving'] as const)[(v >> 11) & 3],
});

/* ---- Enregistrements (communs aux deux générations, g2 = numéros de carte suivis de la génération) ---- */

function session(r: Reader, g2: boolean): CardSession {
  const surname = r.text(35);
  const firstNames = r.text(35);
  const card = cardRef(r, g2);
  const expiry = r.datef();
  const inserted = r.time();
  const odometerIn = r.u24();
  const slot = r.u8();
  const withdrawn = r.time();
  const odometerOut = r.u24();
  r.skip(g2 ? 20 : 19); // véhicule précédent
  const manualInput = r.u8() === 1;
  return { surname, firstNames, card, expiry, inserted, withdrawn, odometerIn, odometerOut, slot, manualInput };
}

function place(r: Reader, g2: boolean): VuPlace {
  const card = cardRef(r, g2);
  return { card, time: r.time(), entryType: r.u8(), country: r.u8(), ...(r.skip(1), { odometer: r.u24() }) };
}

function eventRec(r: Reader, g2: boolean, withSimilar: boolean): VuEvent {
  const e: VuEvent = { type: r.u8(), purpose: r.u8(), begin: r.time(), end: r.time(), card: cardRef(r, g2) };
  r.skip((g2 ? 19 : 18) * 3);
  if (withSimilar) e.similar = r.u8();
  return e;
}

const overspeed = (r: Reader, g2: boolean): Overspeed => {
  const o = { type: r.u8(), begin: (r.skip(1), r.time()), end: r.time(), max: r.u8(), avg: r.u8(), card: cardRef(r, g2) };
  return o;
};

function calibration(r: Reader, size: number): Calibration {
  // 167 : 1re génération. 168 : variante avec octet de génération après le numéro de carte.
  // 222 et plus : 2e génération (expiration de la carte en TimeReal, scellés et numéros de série ensuite).
  const gen2 = size >= 222;
  const purpose = r.u8();
  const workshop = r.text(35);
  r.skip(36); // adresse
  const card = cardRef(r, size === 168);
  if (gen2) r.time();
  else r.datef();
  const vin = r.ia5(17);
  const { plate } = plateOf(r);
  const c: Calibration = {
    purpose, workshop, card, vin, plate, w: r.u16(), k: r.u16(), l: r.u16(), tyre: r.ia5(15), authorisedSpeed: r.u8(),
    oldOdometer: r.u24(), newOdometer: r.u24(), oldTime: r.time(), newTime: r.time(), next: r.time(),
  };
  return c;
}

function identification(r: Reader, approvalLength: number) {
  const manufacturer = r.text(35);
  r.skip(36);
  const partNumber = r.ia5(16);
  const serial = r.u32();
  r.skip(4);
  const software = r.ia5(4);
  r.skip(4);
  const manufactured = r.time();
  const approval = r.ia5(approvalLength);
  return { manufacturer, partNumber, serial, software, manufactured, approval };
}

/* ---- 1re génération ---- */

function overviewG1(r: Reader, vu: VuFile) {
  r.skip(194 + 194);
  vu.vin = r.ia5(17);
  Object.assign(vu, plateOf(r));
  vu.currentTime = r.time();
  vu.periodStart = r.time();
  vu.periodEnd = r.time();
  const s = r.u8();
  vu.slots = { driver: s & 15, codriver: s >> 4 };
  const dl = { time: r.time(), card: cardRef(r, false), company: r.text(35) };
  if (dl.time) vu.downloads.push(dl);
  for (let n = r.u8(); n > 0; n--) vu.locks.push({ lockIn: r.time(), lockOut: r.time(), company: r.text(35), address: r.text(35), card: cardRef(r, false) });
  for (let n = r.u8(); n > 0; n--) vu.controls.push({ type: r.u8(), time: r.time(), card: cardRef(r, false), begin: r.time(), end: r.time() });
  r.skip(128);
}

function activitiesG1(r: Reader, vu: VuFile) {
  const day: VuDay = { date: r.time() ?? new Date(0), odometer: r.u24(), sessions: [], changes: [], places: [], conditions: [] };
  for (let n = r.u16(); n > 0; n--) day.sessions.push(session(r.sub(129), false));
  for (let n = r.u16(); n > 0; n--) day.changes.push(changeOf(r.u16()));
  for (let n = r.u8(); n > 0; n--) day.places.push(place(r.sub(28), false));
  for (let n = r.u16(); n > 0; n--) day.conditions.push({ time: r.time(), type: r.u8() });
  r.skip(128);
  vu.days.push(day);
}

function eventsG1(r: Reader, vu: VuFile) {
  for (let n = r.u8(); n > 0; n--) vu.faults.push(eventRec(r.sub(82), false, false));
  for (let n = r.u8(); n > 0; n--) vu.events.push(eventRec(r.sub(83), false, true));
  vu.overspeedControl = { lastControl: r.time(), firstSince: r.time(), countSince: r.u8() };
  for (let n = r.u8(); n > 0; n--) vu.overspeeds.push(overspeed(r.sub(31), false));
  for (let n = r.u8(); n > 0; n--) {
    const t = r.sub(98);
    vu.timeAdjustments.push({ oldTime: t.time(), newTime: t.time(), workshop: t.text(35), card: (t.skip(36), cardRef(t, false)) });
  }
  r.skip(128);
}

function speedBlocks(r: Reader, n: number, vu: VuFile) {
  for (let i = 0; i < n; i++) {
    const b = r.sub(64);
    const begin = b.time();
    const speeds = [...b.bytes(60)];
    if (begin) vu.speedBlocks.push({ begin, speeds });
  }
}

function technicalG1(r: Reader, vu: VuFile) {
  vu.identification = identification(r.sub(116), 8);
  const s = r.sub(20);
  vu.sensor = { serial: s.u32(), approval: (s.skip(4), s.ia5(8)), paired: s.time() };
  for (let n = r.u8(); n > 0; n--) vu.calibrations.push(calibration(r.sub(167), 167));
  r.skip(128);
}

/* ---- 2e génération : tableaux d'enregistrements ---- */

interface RecordArray {
  type: number;
  size: number;
  records: Reader[];
}

function arrays(r: Reader): RecordArray[] {
  const out: RecordArray[] = [];
  while (r.remaining >= 5 && r.buf[r.pos] !== 0x76) {
    const type = r.u8();
    const size = r.u16();
    const n = r.u16();
    if (size * n > r.remaining) throw new DddError('Tableau d’enregistrements tronqué : le fichier est incomplet ou abîmé.');
    const records: Reader[] = [];
    for (let i = 0; i < n; i++) records.push(r.sub(size));
    out.push({ type, size, records });
  }
  return out;
}

/** Retrouve un tableau par son type officiel, ou par sa position si les types ne sont pas ceux de la norme. */
function picker(list: RecordArray[], firstType: number) {
  const official = list[0]?.type === firstType;
  return (type: number, position: number) => (official ? list.find((a) => a.type === type) : list[position]);
}

function overviewG2(r: Reader, vu: VuFile) {
  const a = arrays(r);
  const get = picker(a, 0x04);
  const vin = get(0x0a, 2)?.records[0];
  if (vin) vu.vin = vin.ia5(17);
  const reg = (get(0x24, 3) ?? get(0x0b, 3))?.records[0];
  if (reg) {
    if (reg.remaining >= 15) Object.assign(vu, plateOf(reg));
    else vu.plate = reg.text(13);
  }
  const now = get(0x03, 4)?.records[0];
  if (now) vu.currentTime = now.time();
  const period = get(0x13, 5)?.records[0];
  if (period) {
    vu.periodStart = period.time();
    vu.periodEnd = period.time();
  }
  const slots = get(0x02, 6)?.records[0];
  if (slots) {
    const s = slots.u8();
    vu.slots = { driver: s & 15, codriver: s >> 4 };
  }
  for (const d of get(0x14, 7)?.records ?? []) {
    const dl = { time: d.time(), card: cardRef(d, true), company: d.text(35) };
    if (dl.time) vu.downloads.push(dl);
  }
  for (const l of get(0x10, 8)?.records ?? []) vu.locks.push({ lockIn: l.time(), lockOut: l.time(), company: l.text(35), address: l.text(35), card: cardRef(l, true) });
  for (const c of get(0x11, 9)?.records ?? []) vu.controls.push({ type: c.u8(), time: c.time(), card: cardRef(c, true), begin: c.time(), end: c.time() });
}

function activitiesG2(r: Reader, vu: VuFile) {
  const a = arrays(r);
  const get = picker(a, 0x06);
  const day: VuDay = {
    date: get(0x06, 0)?.records[0]?.time() ?? new Date(0),
    odometer: get(0x05, 1)?.records[0]?.u24() ?? 0,
    sessions: (get(0x0d, 2)?.records ?? []).map((s) => session(s, true)),
    changes: (get(0x01, 3)?.records ?? []).map((c) => changeOf(c.u16())),
    places: (get(0x1c, 4)?.records ?? []).map((p) => place(p, true)),
    conditions: (get(0x09, 6)?.records ?? []).map((c) => ({ time: c.time(), type: c.u8() })),
  };
  vu.days.push(day);
}

function eventsG2(r: Reader, vu: VuFile) {
  const a = arrays(r);
  const get = picker(a, 0x18);
  vu.faults.push(...(get(0x18, 0)?.records ?? []).map((x) => eventRec(x, true, false)));
  vu.events.push(...(get(0x15, 1)?.records ?? []).map((x) => eventRec(x, true, true)));
  const ctrl = get(0x1a, 2)?.records[0];
  if (ctrl) vu.overspeedControl = { lastControl: ctrl.time(), firstSince: ctrl.time(), countSince: ctrl.u8() };
  vu.overspeeds.push(...(get(0x1b, 3)?.records ?? []).map((x) => overspeed(x, true)));
  for (const t of get(0x1e, 4)?.records ?? []) {
    vu.timeAdjustments.push({ oldTime: t.time(), newTime: t.time(), workshop: t.text(35), card: (t.skip(36), cardRef(t, true)) });
  }
}

function speedG2(r: Reader, vu: VuFile) {
  const a = arrays(r);
  const blocks = picker(a, 0x12)(0x12, 0);
  for (const b of blocks?.records ?? []) speedBlocks(b, 1, vu);
}

function technicalG2(r: Reader, vu: VuFile) {
  const a = arrays(r);
  const get = picker(a, 0x19);
  const id = get(0x19, 0)?.records[0];
  if (id) vu.identification = identification(id, 16);
  const s = (get(0x20, 1) ?? get(0x07, 1))?.records[0];
  if (s && s.remaining >= 28) vu.sensor = { serial: s.u32(), approval: (s.skip(4), s.ia5(16)), paired: s.time() };
  const cal = get(0x0c, 3);
  if (cal && cal.size >= 167) {
    const list = cal.records.map((c) => calibration(c, cal.size));
    // Une vitesse autorisée hors de 30–150 km/h trahit une structure non reconnue : on n'affiche pas de valeurs fausses.
    const plausible = list.filter((c) => c.authorisedSpeed >= 30 && c.authorisedSpeed <= 150);
    if (plausible.length < list.length) vu.warnings.push(`${list.length - plausible.length} étalonnage(s) au format non reconnu (enregistrements de ${cal.size} octets) n’ont pas été affichés.`);
    vu.calibrations.push(...plausible);
  }
}

/* ---- Lecture du fichier ---- */

export function isVuFile(buf: Uint8Array): boolean {
  return buf.length > 2 && buf[0] === 0x76;
}

export function readVu(buf: Uint8Array): VuFile {
  if (!isVuFile(buf)) {
    throw new DddError('Ce fichier n’est pas un téléchargement de véhicule (il devrait commencer par l’octet 76). S’il s’agit d’une carte conducteur, utilisez le lecteur de cartes.');
  }
  const vu: VuFile = {
    generation: 1, version2: false, vin: '', nation: 0, plate: '', downloads: [], locks: [], controls: [], days: [], faults: [], events: [],
    overspeeds: [], timeAdjustments: [], speedBlocks: [], calibrations: [], transfers: 0, warnings: [],
  };
  const r = new Reader(buf);
  while (r.remaining >= 2 && r.buf[r.pos] === 0x76) {
    r.skip(1);
    const trep = r.u8();
    vu.transfers++;
    if (trep >= 0x21) vu.generation = 2;
    if (trep >= 0x31) vu.version2 = true;
    try {
      switch (trep) {
        case 0x00: r.skip(2); break;
        case 0x01: overviewG1(r, vu); break;
        case 0x02: activitiesG1(r, vu); break;
        case 0x03: eventsG1(r, vu); break;
        case 0x04: speedBlocks(r, r.u16(), vu); r.skip(128); break;
        case 0x05: technicalG1(r, vu); break;
        case 0x21: case 0x31: overviewG2(r, vu); break;
        case 0x22: case 0x32: activitiesG2(r, vu); break;
        case 0x23: case 0x33: eventsG2(r, vu); break;
        case 0x24: speedG2(r, vu); break;
        case 0x25: case 0x35: technicalG2(r, vu); break;
        default:
          vu.warnings.push(`Bloc de type ${trep.toString(16).toUpperCase()} non pris en charge : la suite du fichier est ignorée.`);
          return finish(vu);
      }
    } catch (e) {
      if (vu.transfers === 1) throw e instanceof DddError ? e : new DddError('Fichier de véhicule illisible.');
      vu.warnings.push(`Bloc ${trep.toString(16).toUpperCase()} incomplet ou abîmé : la suite du fichier est ignorée.`);
      return finish(vu);
    }
  }
  if (r.remaining > 0 && buf.subarray(r.pos).some((b) => b !== 0 && b !== 0xff)) vu.warnings.push(`${r.remaining} octet(s) non reconnu(s) en fin de fichier, ignorés.`);
  return finish(vu);
}

function finish(vu: VuFile): VuFile {
  vu.days.sort((a, b) => +a.date - +b.date);
  vu.speedBlocks.sort((a, b) => +a.begin - +b.begin);
  if (!vu.days.length && !vu.vin) throw new DddError('Aucune donnée de véhicule lisible dans ce fichier.');
  return vu;
}

/* ---- Chronologies ---- */

/** Segments d'activité d'une fente (0 conducteur, 1 deuxième conducteur), en minutes UTC. */
export function vuSegments(vu: VuFile, slot: 0 | 1, now = new Date()): Segment[] {
  const segs: Segment[] = [];
  const nowMin = Math.floor(+now / 60000);
  for (const d of vu.days) {
    const base = Math.floor(+d.date / 60000 / 1440) * 1440;
    const ch = d.changes.filter((c) => c.slot === slot && c.minute < 1440);
    ch.forEach((c, i) => {
      const start = base + c.minute;
      let end = base + (i + 1 < ch.length ? ch[i + 1].minute : 1440);
      if (end > nowMin) end = Math.max(start, nowMin);
      if (end > start) segs.push({ start, end, activity: c.activity, crew: c.crew, inserted: c.inserted, slot });
    });
  }
  return segs;
}

/** Kilomètres parcourus sur la période lue (compteurs inconnus ou incohérents écartés). */
export function vuDistance(vu: VuFile): number {
  const valid = (n: number) => n > 0 && n < 0xfffff0;
  const odo = vu.days.map((d) => d.odometer).filter(valid);
  const outs = vu.days.flatMap((d) => d.sessions.map((s) => s.odometerOut)).filter(valid);
  if (!odo.length) return 0;
  const last = Math.max(odo[odo.length - 1], ...outs.filter((o) => o >= odo[0] && o - odo[0] < 2_000_000));
  const d = last - Math.min(...odo);
  return d > 0 && d < 2_000_000 ? d : 0;
}

/** Périodes de conduite sans carte dans la fente conducteur. */
export function drivingWithoutCard(vu: VuFile): Segment[] {
  return vuSegments(vu, 0).filter((s) => s.activity === 'driving' && !s.inserted);
}

export const CALIBRATION_PURPOSES: Record<number, string> = {
  1: 'Activation',
  2: 'Première installation',
  3: 'Installation',
  4: 'Inspection périodique',
  5: 'Saisie de l’immatriculation par l’entreprise',
  6: 'Réglage de l’heure sans étalonnage',
};

export const SLOT_STATUS: Record<number, string> = {
  0: 'aucune carte',
  1: 'carte conducteur',
  2: 'carte d’atelier',
  3: 'carte de contrôle',
  4: 'carte d’entreprise',
};

export const CARD_TYPES: Record<number, string> = { 1: 'conducteur', 2: 'atelier', 3: 'contrôle', 4: 'entreprise' };

/* ---- Points d'attention ---- */

export interface VuCheck {
  level: 'infraction' | 'warning' | 'info';
  topic: 'sans-carte' | 'evenements' | 'vitesse' | 'etalonnage' | 'heure' | 'verrou' | 'telechargement';
  message: string;
}

const SERIOUS = new Set([0x04, 0x05, 0x0a, 0x10, 0x13, 0x17, 0x18, 0x19, 0x1c]);
const fr = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/');
const hm = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;

export function vuChecks(vu: VuFile, now = new Date()): VuCheck[] {
  const out: VuCheck[] = [];
  const noCard = drivingWithoutCard(vu);
  if (noCard.length) {
    const total = noCard.reduce((s, x) => s + x.end - x.start, 0);
    const days = new Set(noCard.map((s) => new Date(s.start * 60000).toISOString().slice(0, 10))).size;
    out.push({ level: 'infraction', topic: 'sans-carte', message: `Conduite sans carte conducteur : ${hm(total)} au total, sur ${days} jour${days > 1 ? 's' : ''} (${noCard.length} période${noCard.length > 1 ? 's' : ''}). À justifier par des saisies manuelles ou une impression.` });
  }
  const serious = vu.events.filter((e) => SERIOUS.has(e.type));
  if (serious.length) out.push({ level: 'warning', topic: 'evenements', message: `${serious.length} événement${serious.length > 1 ? 's' : ''} sensible${serious.length > 1 ? 's' : ''} (conduite sans carte appropriée, insertion pendant la conduite, atteinte à la sécurité…) : voir l’onglet Événements.` });
  if (vu.overspeeds.length) {
    const max = Math.max(...vu.overspeeds.map((o) => o.max));
    out.push({ level: 'warning', topic: 'vitesse', message: `${vu.overspeeds.length} excès de vitesse enregistré${vu.overspeeds.length > 1 ? 's' : ''}, vitesse maximale ${max} km/h.` });
  }
  const last = [...vu.calibrations].filter((c) => c.next).sort((a, b) => +b.newTime! - +a.newTime!)[0];
  if (last?.next) {
    const days = Math.floor((+last.next - +now) / 86_400_000);
    if (days < 0) out.push({ level: 'infraction', topic: 'etalonnage', message: `Inspection périodique dépassée : prévue au plus tard le ${fr(last.next)}.` });
    else if (days <= 60) out.push({ level: 'warning', topic: 'etalonnage', message: `Inspection périodique à prévoir avant le ${fr(last.next)} (dans ${days} jours).` });
    else out.push({ level: 'info', topic: 'etalonnage', message: `Prochaine inspection périodique au plus tard le ${fr(last.next)}.` });
  }
  if (vu.timeAdjustments.length) out.push({ level: 'info', topic: 'heure', message: `${vu.timeAdjustments.length} réglage${vu.timeAdjustments.length > 1 ? 's' : ''} de l’heure de l’appareil par un atelier.` });
  const active = vu.locks.filter((l) => l.lockIn && !l.lockOut);
  for (const l of active) out.push({ level: 'info', topic: 'verrou', message: `Verrou d’entreprise actif depuis le ${fr(l.lockIn!)} (${l.company || 'entreprise'}).` });
  if (!vu.locks.length) out.push({ level: 'warning', topic: 'verrou', message: 'Aucun verrou d’entreprise : les données de ce véhicule ne sont pas protégées.' });
  const lastDl = vu.downloads.map((d) => d.time!).sort((a, b) => +b - +a)[0];
  if (lastDl && vu.currentTime && (+vu.currentTime - +lastDl) / 86_400_000 > 90) {
    out.push({ level: 'warning', topic: 'telechargement', message: `Dernier téléchargement le ${fr(lastDl)} : plus de 90 jours avant l’heure de l’appareil.` });
  }
  return out;
}
