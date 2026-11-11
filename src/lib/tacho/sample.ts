/*
 * Fabrique un fichier de carte conducteur entièrement fictif, au format réel (1re ou 2e génération).
 * Sert au bouton « exemple » et aux tests : conducteur « Exemple », véhicules « DEMO », quatre semaines
 * d'activité avec trois écarts volontaires (pause manquante, conduite de 10 h 40, repos de 8 h 30).
 */

type Act = 'R' | 'A' | 'W' | 'D';

export class Writer {
  private parts: number[] = [];
  u8(v: number) { this.parts.push(v & 255); return this; }
  u16(v: number) { return this.u8(v >> 8).u8(v); }
  u24(v: number) { return this.u8(v >> 16).u8(v >> 8).u8(v); }
  u32(v: number) { return this.u16(Math.floor(v / 65536)).u16(v % 65536); }
  time(d?: Date) { return this.u32(d ? Math.floor(+d / 1000) : 0); }
  ascii(s: string, n: number, pad = 0x20) { for (let i = 0; i < n; i++) this.u8(i < s.length ? s.charCodeAt(i) : pad); return this; }
  text(s: string, n: number) { return this.u8(1).ascii(s, n); }
  bcd(n: number, bytes: number) { const s = String(n).padStart(bytes * 2, '0'); for (let i = 0; i < bytes; i++) this.u8(parseInt(s.slice(2 * i, 2 * i + 2), 16)); return this; }
  zeros(n: number) { for (let i = 0; i < n; i++) this.u8(0); return this; }
  bytes() { return Uint8Array.from(this.parts); }
  get length() { return this.parts.length; }
}

const ACT_BITS: Record<Act, number> = { R: 0, A: 1, W: 2, D: 3 };
const FR = 0x11;
const BE = 0x06;

/** Mot ActivityChangeInfo. */
function change(minute: number, act: Act, inserted: boolean, opts: { crew?: boolean; manual?: boolean } = {}) {
  const c = inserted ? (opts.crew ? 1 : 0) : opts.manual ? 1 : 0;
  return (c << 14) | ((inserted ? 0 : 1) << 13) | (ACT_BITS[act] << 11) | minute;
}

interface DayPlan {
  date: string;
  steps: [Act, number][];
  start: number;
  km: number;
  plate: string;
  country: number;
}

/** Programme fictif : 4 semaines, du lundi 5 au dimanche 1er, heures UTC. */
export function samplePlan(): DayPlan[] {
  const normal: [Act, number][] = [['W', 25], ['D', 245], ['R', 45], ['D', 200], ['W', 40], ['A', 20], ['D', 55], ['W', 15]];
  const short: [Act, number][] = [['W', 20], ['D', 180], ['R', 45], ['D', 150], ['W', 30]];
  const plans: DayPlan[] = [];
  const start = Date.UTC(2026, 9, 5); // lundi 5 octobre 2026
  for (let i = 0; i < 26; i++) {
    const d = new Date(start + i * 86_400_000);
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    let steps = normal;
    let begin = 5 * 60;
    if (i === 2) steps = [['W', 20], ['D', 290], ['R', 45], ['D', 200], ['W', 30]]; // conduite continue de 4 h 50
    if (i === 8) steps = [['W', 15], ['D', 260], ['R', 45], ['D', 270], ['R', 45], ['D', 110], ['W', 20]]; // 10 h 40
    if (i === 15) begin = 6 * 60;
    if (i === 16) { begin = 75; steps = short; } // repos de 8 h 30 seulement après la veille
    if (i === 22) steps = short;
    plans.push({
      date: d.toISOString().slice(0, 10),
      steps,
      start: begin,
      km: steps.filter(([a]) => a === 'D').reduce((t, [, m]) => t + m, 0) * 1.2 | 0,
      plate: i < 12 ? 'DEMO-01' : 'DEMO-02',
      country: i === 9 ? BE : FR,
    });
  }
  return plans;
}

function tlv(w: Writer, fid: number, app: number, body: Uint8Array) {
  w.u16(fid).u8(app).u16(body.length);
  for (const b of body) w.u8(b);
}

/** Tampon circulaire d'activités de longueur L, éventuellement décalé pour tester le rebouclage. */
function activityEf(records: Uint8Array[], L: number, offset: number): Uint8Array {
  const buf = new Uint8Array(L);
  let pos = offset % L;
  let oldest = pos;
  let newest = pos;
  records.forEach((rec, i) => {
    if (i === 0) oldest = pos;
    newest = pos;
    for (let k = 0; k < rec.length; k++) buf[(pos + k) % L] = rec[k];
    pos = (pos + rec.length) % L;
  });
  const w = new Writer().u16(oldest).u16(newest);
  for (const b of buf) w.u8(b);
  return w.bytes();
}

export function sampleCard(gen: 1 | 2 = 2, opts: { activityLength?: number; offset?: number } = {}): Uint8Array {
  const plans = samplePlan();
  const out = new Writer();
  const apps = gen === 2 ? [0, 2] : [0];
  const t = (iso: string) => new Date(iso);

  // Activités : un enregistrement par jour d'activité (le jour du retrait de la carte inclus).
  const records: Uint8Array[] = [];
  let prevLen = 0;
  const vehicles: { first: Date; last: Date; plate: string; odoBegin: number; odoEnd: number }[] = [];
  const places: { time: Date; type: number; country: number; odo: number }[] = [];
  let odo = 182_340;
  plans.forEach((p, i) => {
    const words: number[] = [change(0, 'R', false)];
    if (i === 5) words[0] = change(0, 'R', false, { manual: true }); // repos saisi manuellement
    let m = p.start;
    for (const [a, dur] of p.steps) {
      words.push(change(m, a, true));
      m += dur;
    }
    words.push(change(m, 'R', false));
    const w = new Writer().u16(prevLen);
    const len = 12 + words.length * 2;
    w.u16(len).time(new Date(p.date + 'T00:00:00Z')).bcd(100 + i, 2).u16(p.km);
    for (const v of words) w.u16(v);
    records.push(w.bytes());
    prevLen = len;
    const begin = new Date(Date.parse(p.date) + p.start * 60_000);
    const end = new Date(Date.parse(p.date) + m * 60_000);
    const last = vehicles[vehicles.length - 1];
    if (last && last.plate === p.plate) { last.last = end; last.odoEnd = odo + p.km; }
    else vehicles.push({ first: begin, last: end, plate: p.plate, odoBegin: odo, odoEnd: odo + p.km });
    places.push({ time: begin, type: 0, country: p.country, odo });
    odo += p.km;
    places.push({ time: end, type: 1, country: FR, odo });
  });
  const L = opts.activityLength ?? (gen === 2 ? 13776 : 5544);

  for (const app of apps) {
    const g2 = app === 2;
    if (app === 0) {
      tlv(out, 0x0002, 0, new Writer().zeros(25).bytes());
      tlv(out, 0x0005, 0, new Writer().zeros(8).bytes());
    }
    const nEvents = 6, nFaults = 12, nVeh = 84, nPlaces = 84;
    const appId = new Writer().u8(1).u16(g2 ? 0x0100 : 0x0000).u8(nEvents).u8(nFaults).u16(L).u16(nVeh);
    if (g2) appId.u16(nPlaces).u16(252).u16(56).u16(84);
    else appId.u8(nPlaces);
    tlv(out, 0x0501, app, appId.bytes());
    tlv(out, 0x0501, app + 1, new Writer().zeros(g2 ? 64 : 128).bytes());

    tlv(out, 0x0520, app, new Writer()
      .u8(FR).ascii('DEMO0000000001', 14).ascii('0', 1).ascii('0', 1)
      .text('CARTE DE DEMONSTRATION', 35)
      .time(t('2024-03-01T00:00:00Z')).time(t('2024-03-01T00:00:00Z')).time(t('2029-02-28T23:59:59Z'))
      .text('EXEMPLE', 35).text('Jean', 35)
      .bcd(19800101, 4).ascii('fr', 2).bytes());
    tlv(out, 0x0521, app, new Writer().text('PREFECTURE DEMO', 35).u8(FR).ascii('DEMO-PERMIS-0001', 16).bytes());

    const events = new Writer();
    for (let k = 0; k < nEvents * (g2 ? 11 : 6); k++) {
      if (k === 0) events.u8(0x05).time(t('2026-10-13T05:20:00Z')).time(t('2026-10-13T05:21:00Z')).u8(FR).text('DEMO-01', 13);
      else events.zeros(24);
    }
    tlv(out, 0x0502, app, events.bytes());
    const faults = new Writer();
    for (let k = 0; k < nFaults * 2; k++) {
      if (k === 0) faults.u8(0x32).time(t('2026-10-21T14:02:00Z')).time(t('2026-10-21T14:10:00Z')).u8(FR).text('DEMO-02', 13);
      else faults.zeros(24);
    }
    tlv(out, 0x0503, app, faults.bytes());

    tlv(out, 0x0504, app, activityEf(records, L, opts.offset ?? 0));

    const veh = new Writer().u16(vehicles.length - 1);
    for (let k = 0; k < nVeh; k++) {
      const v = vehicles[k];
      if (v) veh.u24(v.odoBegin).u24(v.odoEnd).time(v.first).time(v.last).u8(FR).text(v.plate, 13).bcd(k + 1, 2);
      else veh.zeros(31);
      if (g2) v ? veh.ascii('VF6DEMO0000000001', 17) : veh.zeros(17);
    }
    tlv(out, 0x0505, app, veh.bytes());

    const pl = new Writer();
    g2 ? pl.u16(places.length - 1) : pl.u8(places.length - 1);
    for (let k = 0; k < nPlaces; k++) {
      const p = places[k];
      if (p) pl.time(p.time).u8(p.type).u8(p.country).u8(0).u24(p.odo);
      else pl.zeros(10);
      // GNSS : 45°45,0' N, 4°50,0' E (fictif), précision 10 m
      if (g2) p ? pl.time(p.time).u8(10).u24(45450).u24(4500) : pl.zeros(11);
    }
    tlv(out, 0x0506, app, pl.bytes());

    tlv(out, 0x0507, app, new Writer().zeros(19).bytes());
    tlv(out, 0x0508, app, new Writer().u8(0x80).time(t('2026-10-20T09:15:00Z')).u8(3).u8(FR).ascii('CTRL000000000001', 16).u8(FR).text('DEMO-01', 13)
      .time(t('2026-09-22T00:00:00Z')).time(t('2026-10-20T09:15:00Z')).bytes());
    tlv(out, 0x050e, app, new Writer().time(t('2026-11-02T08:00:00Z')).bytes());
    const cond = new Writer();
    if (g2) cond.u16(0);
    for (let k = 0; k < 56; k++) k === 0 ? cond.time(t('2026-10-14T15:00:00Z')).u8(3) : cond.zeros(5);
    tlv(out, 0x0522, app, cond.bytes());
  }
  return out.bytes();
}
