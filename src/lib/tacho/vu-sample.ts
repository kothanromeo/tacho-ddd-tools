import { Writer } from './sample';

/*
 * Téléchargement de véhicule entièrement fictif (1re génération) : camion « DEMO-01 », deux conducteurs
 * fictifs, une semaine d'activité avec 25 minutes de conduite sans carte, un excès de vitesse,
 * la vitesse détaillée d'une journée et deux étalonnages.
 */

const FR = 0x11;
const ACT = { R: 0, A: 1, W: 2, D: 3 } as const;
type Act = keyof typeof ACT;
const t = (iso: string) => new Date(iso);

function card(w: Writer, type: number, number: string) {
  w.u8(type).u8(FR).ascii(number, 16);
}

function change(slot: 0 | 1, minute: number, act: Act, inserted: boolean) {
  return (slot << 15) | ((inserted ? 0 : 1) << 13) | (ACT[act] << 11) | minute;
}

interface DriverDef {
  surname: string;
  first: string;
  number: string;
}
const JEAN: DriverDef = { surname: 'EXEMPLE', first: 'Jean', number: 'DEMO000000000100' };
const MARIE: DriverDef = { surname: 'DEMO', first: 'Marie', number: 'DEMO000000000200' };

interface DayDef {
  date: string;
  driver: DriverDef;
  /** Insertion et retrait, en minutes UTC depuis minuit. */
  inMin: number;
  steps: [Act, number][];
  /** Conduite sans carte après le retrait (minutes). */
  noCard?: number;
}

const DAYS: DayDef[] = [
  { date: '2026-11-02', driver: JEAN, inMin: 300, steps: [['W', 20], ['D', 240], ['R', 45], ['D', 210], ['W', 30]] },
  { date: '2026-11-03', driver: JEAN, inMin: 300, steps: [['W', 15], ['D', 250], ['R', 45], ['D', 200], ['W', 40]] },
  { date: '2026-11-04', driver: MARIE, inMin: 330, steps: [['W', 25], ['D', 230], ['R', 50], ['D', 180], ['W', 30]], noCard: 25 },
  { date: '2026-11-05', driver: JEAN, inMin: 300, steps: [['W', 20], ['D', 260], ['R', 45], ['D', 190], ['A', 30], ['W', 20]] },
  { date: '2026-11-06', driver: JEAN, inMin: 300, steps: [['W', 20], ['D', 180], ['R', 45], ['D', 120], ['W', 25]] },
];

function sessions(w: Writer, d: DayDef, base: number, km: { in: number; out: number }) {
  const out = d.inMin + d.steps.reduce((s, [, m]) => s + m, 0);
  w.text(d.driver.surname, 35).text(d.driver.first, 35);
  card(w, 1, d.driver.number);
  w.bcd(20290228, 4).time(new Date((base + d.inMin) * 60000)).u24(km.in).u8(0).time(new Date((base + out) * 60000)).u24(km.out);
  w.u8(FR).text('DEMO-01', 13).time(new Date((base - 600) * 60000)); // véhicule précédent
  w.u8(0);
  return out;
}

export function sampleVu(): Uint8Array {
  const w = new Writer();
  // --- Vue d'ensemble (TREP 01)
  w.u8(0x76).u8(0x01).zeros(194 + 194).ascii('VF6DEMO0000000001', 17).u8(FR).text('DEMO-01', 13)
    .time(t('2026-11-09T07:30:00Z')).time(t('2026-08-01T00:00:00Z')).time(t('2026-11-09T07:29:00Z')).u8(0x01)
    .time(t('2026-11-09T07:28:00Z'));
  card(w, 4, 'DEMOENTREPRISE01');
  w.text('TRANSPORTS DEMO', 35);
  w.u8(1).time(t('2026-03-01T08:00:00Z')).time(undefined).text('TRANSPORTS DEMO', 35).text('1 RUE DE L EXEMPLE 69000 LYON', 35);
  card(w, 4, 'DEMOENTREPRISE01');
  w.u8(1).u8(0x80).time(t('2026-10-20T09:15:00Z'));
  card(w, 3, 'CTRL000000000001');
  w.time(t('2026-09-22T00:00:00Z')).time(t('2026-10-20T09:15:00Z')).zeros(128);

  // --- Activités (TREP 02), une par jour
  let odo = 412_380;
  for (const d of DAYS) {
    const base = Date.parse(d.date + 'T00:00:00Z') / 60000;
    const drive = d.steps.filter(([a]) => a === 'D').reduce((s, [, m]) => s + m, 0);
    const kmIn = odo;
    const kmOut = odo + Math.round(drive * 1.25);
    w.u8(0x76).u8(0x02).time(new Date(base * 60000)).u24(odo);
    w.u16(1);
    const out = sessions(w, d, base, { in: kmIn, out: kmOut });
    const changes: number[] = [change(0, 0, 'R', false), change(1, 0, 'R', false)];
    let m = d.inMin;
    for (const [a, dur] of d.steps) {
      changes.push(change(0, m, a, true));
      m += dur;
    }
    changes.push(change(0, out, 'R', false));
    if (d.noCard) {
      changes.push(change(0, out + 20, 'D', false));
      changes.push(change(0, out + 20 + d.noCard, 'R', false));
    }
    w.u16(changes.length);
    for (const c of changes) w.u16(c);
    w.u8(2);
    card(w, 1, d.driver.number);
    w.time(new Date((base + d.inMin) * 60000)).u8(0).u8(FR).u8(0).u24(kmIn);
    card(w, 1, d.driver.number);
    w.time(new Date((base + out) * 60000)).u8(1).u8(FR).u8(0).u24(kmOut);
    w.u16(0).zeros(128);
    odo = kmOut + (d.noCard ? 30 : 0);
  }

  // --- Événements et défauts (TREP 03)
  w.u8(0x76).u8(0x03);
  w.u8(1).u8(0x32).u8(0).time(t('2026-11-05T14:02:00Z')).time(t('2026-11-05T14:10:00Z'));
  card(w, 1, JEAN.number);
  w.zeros(18 * 3);
  w.u8(2);
  w.u8(0x04).u8(0).time(t('2026-11-04T17:20:00Z')).time(t('2026-11-04T17:45:00Z')).zeros(18 * 4).u8(0);
  w.u8(0x05).u8(0).time(t('2026-11-03T05:01:00Z')).time(t('2026-11-03T05:02:00Z'));
  card(w, 1, JEAN.number);
  w.zeros(18 * 3).u8(0);
  w.time(t('2026-10-20T09:15:00Z')).time(t('2026-11-06T09:41:00Z')).u8(1);
  w.u8(1).u8(0x07).u8(0).time(t('2026-11-06T09:41:00Z')).time(t('2026-11-06T09:43:00Z')).u8(97).u8(93);
  card(w, 1, JEAN.number);
  w.u8(0);
  w.u8(0).zeros(128);

  // --- Vitesse détaillée (TREP 04) : la journée du 6 novembre
  const blocks: number[][] = [];
  const start = Date.parse('2026-11-06T05:20:00Z');
  for (let i = 0; i < 300; i++) {
    if (i >= 180 && i < 225) continue; // pause
    const speeds: number[] = [];
    for (let s = 0; s < 60; s++) {
      const x = i * 60 + s;
      let v = 84 + Math.round(4 * Math.sin(x / 97) + 2 * Math.sin(x / 13));
      if (i < 3) v = Math.min(v, Math.round((x / 180) * 85));
      if (i === 141 || i === 142) v = 96 + (s % 3); // excès de vitesse
      if (i >= 60 && i < 70) v = Math.max(0, 48 + Math.round(10 * Math.sin(x / 20))); // traversée de ville
      speeds.push(Math.max(0, Math.min(125, v)));
    }
    blocks.push([i, ...speeds]);
  }
  w.u8(0x76).u8(0x04).u16(blocks.length);
  for (const [i, ...speeds] of blocks) {
    w.time(new Date(start + i * 60000));
    for (const v of speeds) w.u8(v);
  }
  w.zeros(128);

  // --- Données techniques (TREP 05)
  w.u8(0x76).u8(0x05).text('DEMO TACHYGRAPHES', 35).text('ZONE DE DEMONSTRATION', 35).ascii('DEMO-VU-0001', 16)
    .u32(123456).bcd(324, 2).u8(6).u8(0xa1).ascii('0102', 4).time(t('2024-03-01T00:00:00Z')).time(t('2024-01-15T00:00:00Z')).ascii('e1-DEMO', 8);
  w.u32(654321).bcd(124, 2).u8(7).u8(0xa1).ascii('e1-DEMO2', 8).time(t('2024-03-01T00:00:00Z'));
  w.u8(2);
  for (const [purpose, when, next] of [[3, '2024-03-01T08:00:00Z', '2026-03-01T00:00:00Z'], [4, '2026-02-10T10:00:00Z', '2028-02-10T00:00:00Z']] as const) {
    w.u8(purpose).text('ATELIER DEMO', 35).text('2 AVENUE DE L EXEMPLE 69000 LYON', 35);
    card(w, 2, 'ATELIERDEMO00001');
    w.bcd(20290101, 4).ascii('VF6DEMO0000000001', 17).u8(FR).text('DEMO-01', 13).u16(8000).u16(8000).u16(3260).ascii('315/80 R22.5', 15).u8(90)
      .u24(0).u24(purpose === 3 ? 12 : 398_000).time(t(when)).time(t(when)).time(t(next));
  }
  w.zeros(128);
  return w.bytes();
}
