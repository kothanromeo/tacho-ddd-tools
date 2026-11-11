/*
 * Chronologie continue des activités d'un conducteur, en minutes depuis le 01/01/1970 UTC.
 */

export type Activity = 'rest' | 'available' | 'work' | 'driving' | 'unknown';

export interface Segment {
  /** Début et fin en minutes UTC depuis l'époque Unix (fin exclue). */
  start: number;
  end: number;
  activity: Activity;
  /** Conduite en équipage (plusieurs conducteurs). */
  crew: boolean;
  /** Carte insérée (false : période hors véhicule, saisie manuelle ou inconnue). */
  inserted: boolean;
  /** Fente du lecteur : conducteur (0) ou deuxième conducteur (1). */
  slot: 0 | 1;
}

export const MIN = 60_000;
export const toMin = (d: Date) => Math.floor(d.getTime() / MIN);
export const fromMin = (m: number) => new Date(m * MIN);

/** Fusionne les segments contigus de même nature et comble les trous par « inconnu ». */
export function normalize(segments: Segment[]): Segment[] {
  const sorted = segments.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start < last.end) {
      // Chevauchement (enregistrements dupliqués) : on garde le plus récent.
      if (s.end <= last.end) continue;
      s.start = last.end;
    }
    if (last && s.start > last.end) out.push({ start: last.end, end: s.start, activity: 'unknown', crew: false, inserted: false, slot: 0 });
    const prev = out[out.length - 1];
    if (prev && prev.end === s.start && prev.activity === s.activity && prev.crew === s.crew && prev.inserted === s.inserted && prev.slot === s.slot) prev.end = s.end;
    else out.push({ ...s });
  }
  return out;
}

/** Une période est-elle du repos au sens de la réglementation ? Carte retirée sans saisie : présumée repos. */
export const isRest = (s: Segment) => s.activity === 'rest' || s.activity === 'unknown';

/** Périodes de repos continues (repos + inconnu fusionnés). */
export function restPeriods(segs: Segment[]): { start: number; end: number; unknown: number }[] {
  const out: { start: number; end: number; unknown: number }[] = [];
  for (const s of segs) {
    if (!isRest(s)) continue;
    const last = out[out.length - 1];
    const unknown = s.activity === 'unknown' ? s.end - s.start : 0;
    if (last && last.end === s.start) {
      last.end = s.end;
      last.unknown += unknown;
    } else out.push({ start: s.start, end: s.end, unknown });
  }
  return out;
}

/* ---- Fuseaux horaires : découpage par jour local ---- */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function offsetMinutes(tz: string, atMs: number): number {
  if (tz === 'UTC') return 0;
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    fmtCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(atMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((asUtc - Math.floor(atMs / MIN) * MIN) / MIN);
}

/** Jour local (AAAA-MM-JJ) d'une minute UTC. */
export function localDay(m: number, tz: string): string {
  return new Date((m + offsetMinutes(tz, m * MIN)) * MIN).toISOString().slice(0, 10);
}

/** Minute UTC correspondant à minuit local du jour donné. */
export function localMidnight(day: string, tz: string): number {
  const guess = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / MIN;
  let m = guess - offsetMinutes(tz, guess * MIN);
  m = guess - offsetMinutes(tz, m * MIN);
  return m;
}

/** Heure locale HH:MM d'une minute UTC. */
export function localTime(m: number, tz: string): string {
  return new Date((m + offsetMinutes(tz, m * MIN)) * MIN).toISOString().slice(11, 16);
}

export const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

/** Découpe la chronologie en journées locales. */
export function splitDays(segs: Segment[], tz: string): Map<string, Segment[]> {
  const days = new Map<string, Segment[]>();
  for (const s of segs) {
    let start = s.start;
    while (start < s.end) {
      const day = localDay(start, tz);
      const next = localMidnight(addDays(day, 1), tz);
      const end = Math.min(s.end, next);
      if (!days.has(day)) days.set(day, []);
      days.get(day)!.push({ ...s, start, end });
      start = end;
    }
  }
  return days;
}

/** Durée en minutes → « 9 h 05 ». */
export function hm(minutes: number): string {
  const sign = minutes < 0 ? '−' : '';
  const m = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
