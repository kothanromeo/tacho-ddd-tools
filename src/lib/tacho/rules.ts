import { addDays, hm, isRest, localDay, localMidnight, localTime, restPeriods, splitDays, type Activity, type Segment } from './timeline';

/*
 * Contrôle indicatif des temps de conduite et de repos (règlement (CE) 561/2006 modifié).
 * Les cas complexes (ferry, train, dérogations nationales, transport international
 * avec deux repos hebdomadaires réduits) ne peuvent pas être jugés à partir de la carte seule :
 * ils sont signalés « à vérifier », jamais comme infraction certaine.
 */

export type Level = 'infraction' | 'warning' | 'info';

export interface Finding {
  level: Level;
  rule: 'pause' | 'conduite-jour' | 'repos-jour' | 'repos-hebdo' | 'conduite-semaine' | 'conduite-2-semaines' | 'carte';
  /** Minute UTC à laquelle le constat se situe. */
  at: number;
  message: string;
}

export interface DayStats {
  day: string;
  driving: number;
  work: number;
  available: number;
  rest: number;
  unknown: number;
  crew: boolean;
  /** Début de la première et fin de la dernière activité hors repos. */
  first?: number;
  last?: number;
  segments: Segment[];
}

export interface WorkPeriod {
  start: number;
  end: number;
  driving: number;
  restStart?: number;
  restEnd?: number;
  /** Repos journalier qui clôt la période. */
  restType: 'normal' | 'fractionné' | 'réduit' | 'hebdomadaire' | 'insuffisant' | 'en cours';
}

export interface WeekStats {
  monday: string;
  driving: number;
  extendedDays: number;
}

export interface Analysis {
  days: DayStats[];
  periods: WorkPeriod[];
  weeks: WeekStats[];
  weeklyRests: { start: number; end: number; reduced: boolean }[];
  findings: Finding[];
}

const H = 60;


function dayStats(segs: Segment[], tz: string): DayStats[] {
  const out: DayStats[] = [];
  for (const [day, list] of [...splitDays(segs, tz)].sort((a, b) => a[0].localeCompare(b[0]))) {
    const d: DayStats = { day, driving: 0, work: 0, available: 0, rest: 0, unknown: 0, crew: false, segments: list };
    for (const s of list) {
      const dur = s.end - s.start;
      d[s.activity === 'rest' ? 'rest' : s.activity] += dur;
      if (s.crew && s.activity === 'driving') d.crew = true;
      if (!isRest(s)) {
        d.first ??= s.start;
        d.last = s.end;
      }
    }
    out.push(d);
  }
  return out;
}

const sumOf = (segs: Segment[], a: Activity, from: number, to: number) =>
  segs.reduce((t, s) => (s.activity === a ? t + Math.max(0, Math.min(s.end, to) - Math.max(s.start, from)) : t), 0);

/** Pause après 4 h 30 de conduite : 45 min, ou 15 min puis 30 min. */
function checkBreaks(segs: Segment[], tz: string, out: Finding[]) {
  let driving = 0;
  let split15 = false;
  let overAt: number | undefined;
  const close = () => {
    if (overAt !== undefined) {
      out.push({ level: 'infraction', rule: 'pause', at: overAt, message: `Conduite de ${hm(driving)} sans pause suffisante (maximum 4 h 30 avant une pause de 45 min, ou 15 min puis 30 min), à partir de ${localTime(overAt, tz)} le ${fr(localDay(overAt, tz))}.` });
    }
    driving = 0;
    split15 = false;
    overAt = undefined;
  };
  for (const s of segs) {
    const dur = s.end - s.start;
    if (s.activity === 'driving') {
      if (driving + dur > 270 && overAt === undefined) overAt = s.start + (270 - driving);
      driving += dur;
    } else if (isRest(s) || (s.activity === 'available' && s.crew && s.slot === 1)) {
      if (dur >= 45) close();
      else if (split15 && dur >= 30) close();
      else if (dur >= 15) split15 = true;
    }
  }
  close();
}

const fr = (day: string) => day.split('-').reverse().join('/');

/** Lundi (AAAA-MM-JJ) de la semaine d'un jour. */
export function mondayOf(day: string): string {
  const wd = (new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return addDays(day, -wd);
}

export function analyze(raw: Segment[], tz = 'Europe/Paris'): Analysis {
  const segs = raw;
  const findings: Finding[] = [];
  const days = dayStats(segs, tz);
  if (!segs.length) return { days, periods: [], weeks: [], weeklyRests: [], findings };
  const dataEnd = segs[segs.length - 1].end;
  const rests = restPeriods(segs);

  checkBreaks(segs, tz, findings);

  /* -- Repos hebdomadaires : repos d'au moins 24 h -- */
  const weeklyRests = rests.filter((r) => r.end - r.start >= 24 * H).map((r) => ({ start: r.start, end: r.end, reduced: r.end - r.start < 45 * H }));
  for (let i = 0; i < weeklyRests.length; i++) {
    const w = weeklyRests[i];
    const next = weeklyRests[i + 1];
    // Le repos hebdomadaire suivant doit commencer au plus tard six périodes de 24 h après la fin du précédent.
    const deadline = w.end + 144 * H;
    if (next && next.start > deadline) {
      findings.push({ level: 'infraction', rule: 'repos-hebdo', at: deadline, message: `Repos hebdomadaire commencé ${hm(next.start - deadline)} trop tard : plus de six périodes de 24 h après le précédent (terminé le ${fr(localDay(w.end, tz))} à ${localTime(w.end, tz)}).` });
    } else if (!next && segs.some((s) => s.start >= deadline && !isRest(s))) {
      findings.push({ level: 'infraction', rule: 'repos-hebdo', at: deadline, message: `Pas de repos hebdomadaire dans les six périodes de 24 h suivant celui terminé le ${fr(localDay(w.end, tz))} à ${localTime(w.end, tz)}.` });
    }
    if (next && w.reduced && next.reduced) {
      findings.push({ level: 'warning', rule: 'repos-hebdo', at: next.start, message: `Deux repos hebdomadaires réduits consécutifs (${hm(w.end - w.start)} puis ${hm(next.end - next.start)}) : admis seulement en transport international de marchandises, hors de l’État d’établissement, avec compensation. À vérifier.` });
    }
  }

  /* -- Périodes de travail journalières et repos journaliers -- */
  const periods: WorkPeriod[] = [];
  /** Premier instant d'activité (hors repos) à partir de `time`. */
  const nextActive = (time: number) => {
    const s = segs.find((x) => x.end > time && !isRest(x));
    return s ? Math.max(s.start, time) : undefined;
  };
  let t0 = segs.find((s) => !isRest(s))?.start;
  let reducedSinceWeekly = 0;
  while (t0 !== undefined && t0 < dataEnd) {
    const crew = segs.some((s) => s.crew && s.activity === 'driving' && s.start < t0! + 30 * H && s.end > t0!);
    const windowEnd = t0 + (crew ? 30 : 24) * H;
    const regular = crew ? 9 * H : 11 * H;
    const cands = rests
      .filter((r) => r.end > t0! && r.start < windowEnd && r.start >= t0!)
      .map((r) => ({ r, clipped: Math.min(r.end, windowEnd) - Math.max(r.start, t0!) }));
    let pick: (typeof cands)[number] | undefined;
    let type: WorkPeriod['restType'] = 'insuffisant';
    pick = cands.find((c) => c.clipped >= regular);
    if (pick) type = pick.r.end - pick.r.start >= 24 * H ? 'hebdomadaire' : 'normal';
    if (!pick && !crew) {
      const first3 = cands.findIndex((c) => c.clipped >= 3 * H);
      const second = first3 >= 0 ? cands.slice(first3 + 1).find((c) => c.clipped >= 9 * H) : undefined;
      if (second) {
        pick = second;
        type = 'fractionné';
      } else {
        pick = cands.find((c) => c.clipped >= 9 * H);
        if (pick) type = 'réduit';
      }
    }
    if (!pick) {
      if (windowEnd > dataEnd) {
        // Fenêtre non terminée à la fin des données : on ne peut pas conclure.
        periods.push({ start: t0, end: dataEnd, driving: sumOf(segs, 'driving', t0, dataEnd), restType: 'en cours' });
        break;
      }
      const longestAny = cands.reduce<(typeof cands)[number] | undefined>((a, c) => (!a || c.clipped > a.clipped ? c : a), undefined);
      // Un repos de moins de 3 h ne peut pas servir de coupure entre deux journées.
      const longest = longestAny && longestAny.clipped >= 3 * H ? longestAny : undefined;
      findings.push({
        level: 'infraction', rule: 'repos-jour', at: windowEnd,
        message: `Repos journalier insuffisant : ${longestAny ? `le plus long repos pris dans les ${crew ? 30 : 24} h n’atteint que ${hm(longestAny.clipped)}` : 'aucun repos'} (minimum ${crew ? '9 h en équipage' : '11 h, ou 9 h en repos réduit'}), période commencée le ${fr(localDay(t0, tz))} à ${localTime(t0, tz)}.`,
      });
      // On clôt la période sur le plus long repos de la fenêtre (à défaut, à la fin de la fenêtre)
      // et l'on reprend ensuite : un seul constat par fenêtre de 24 h, jamais de « journée » de plusieurs jours.
      if (!longest) {
        const end = windowEnd;
        periods.push({ start: t0, end, driving: sumOf(segs, 'driving', t0, end), restType: 'insuffisant' });
        t0 = nextActive(end);
        continue;
      }
      pick = longest;
    }
    const end = pick.r.start;
    const driving = sumOf(segs, 'driving', t0, end);
    periods.push({ start: t0, end, driving, restStart: pick.r.start, restEnd: pick.r.end, restType: type });

    if (type === 'réduit') {
      reducedSinceWeekly++;
      if (reducedSinceWeekly > 3) findings.push({ level: 'infraction', rule: 'repos-jour', at: pick.r.start, message: `Plus de trois repos journaliers réduits entre deux repos hebdomadaires (${reducedSinceWeekly}e le ${fr(localDay(pick.r.start, tz))}).` });
    }
    if (pick.r.end - pick.r.start >= 24 * H) reducedSinceWeekly = 0;
    if (driving > 10 * H) {
      findings.push({ level: 'infraction', rule: 'conduite-jour', at: t0, message: `Conduite journalière de ${hm(driving)} le ${fr(localDay(t0, tz))} : maximum 9 h, ou 10 h deux fois par semaine.` });
    }
    t0 = nextActive(pick.r.end);
  }

  /* -- Semaines : conduite hebdomadaire, deux semaines, extensions à 10 h -- */
  const weekMap = new Map<string, WeekStats>();
  for (const d of days) {
    const monday = mondayOf(d.day);
    const w = weekMap.get(monday) ?? { monday, driving: 0, extendedDays: 0 };
    w.driving += d.driving;
    weekMap.set(monday, w);
  }
  for (const p of periods) {
    if (p.driving > 9 * H && p.driving <= 10 * H) {
      const w = weekMap.get(mondayOf(localDay(p.start, tz)));
      if (w) {
        w.extendedDays++;
        if (w.extendedDays === 3) findings.push({ level: 'infraction', rule: 'conduite-jour', at: p.start, message: `Troisième journée de conduite au-delà de 9 h dans la semaine du ${fr(w.monday)} (le ${fr(localDay(p.start, tz))}, ${hm(p.driving)}) : deux extensions à 10 h au plus par semaine.` });
      }
    }
  }
  const weeks = [...weekMap.values()].sort((a, b) => a.monday.localeCompare(b.monday));
  weeks.forEach((w, i) => {
    if (w.driving > 56 * H) findings.push({ level: 'infraction', rule: 'conduite-semaine', at: localMidnight(w.monday, tz), message: `Conduite hebdomadaire de ${hm(w.driving)} la semaine du ${fr(w.monday)} : maximum 56 h.` });
    const prev = weeks[i - 1];
    if (prev && addDays(prev.monday, 7) === w.monday && prev.driving + w.driving > 90 * H) {
      findings.push({ level: 'infraction', rule: 'conduite-2-semaines', at: localMidnight(w.monday, tz), message: `Conduite de ${hm(prev.driving + w.driving)} sur les deux semaines du ${fr(prev.monday)} et du ${fr(w.monday)} : maximum 90 h.` });
    }
  });

  findings.sort((a, b) => a.at - b.at);
  return { days, periods, weeks, weeklyRests, findings };
}


