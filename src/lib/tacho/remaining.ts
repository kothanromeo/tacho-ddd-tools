/*
 * « Combien de temps puis-je encore conduire ? » — calcul à partir de quelques compteurs saisis à la main.
 * Toutes les durées sont en minutes.
 */

export interface RemainingInput {
  /** Conduite depuis la dernière pause valable (45 min, ou 15 + 30). */
  sinceBreak: number;
  /** Une première pause de 15 min a déjà été prise depuis la dernière pause complète. */
  split15: boolean;
  /** Conduite depuis la fin du dernier repos journalier ou hebdomadaire. */
  today: number;
  /** Jours de conduite déjà prolongés au-delà de 9 h cette semaine (0 à 2). */
  extensionsUsed: number;
  /** Conduite depuis lundi 00:00. */
  week: number;
  /** Conduite de la semaine précédente. */
  lastWeek: number;
  /** Minutes écoulées depuis la fin du dernier repos journalier (début de la journée de travail). */
  sinceRest?: number;
  /** Repos journaliers réduits déjà pris depuis le dernier repos hebdomadaire (0 à 3). */
  reducedUsed?: number;
}

export interface Limit {
  key: 'pause' | 'jour' | 'semaine' | 'deux-semaines' | 'amplitude';
  label: string;
  remaining: number;
  detail: string;
}

export interface RemainingResult {
  limits: Limit[];
  /** Contrainte la plus serrée, avant la prochaine pause. */
  next: Limit;
  /** Conduite encore possible aujourd'hui, pauses comprises. */
  todayMax: number;
}

const clamp = (n: number) => Math.max(0, n);

export function remaining(i: RemainingInput): RemainingResult {
  const canExtend = i.extensionsUsed < 2;
  const dayCap = canExtend ? 600 : 540;
  const limits: Limit[] = [
    {
      key: 'pause',
      label: 'Avant la prochaine pause',
      remaining: clamp(270 - i.sinceBreak),
      detail: i.split15
        ? 'Vous avez déjà pris 15 min : une pause de 30 min suffira ensuite.'
        : 'Pause de 45 min, ou 15 min puis plus tard 30 min.',
    },
    {
      key: 'jour',
      label: 'Conduite journalière',
      remaining: clamp(dayCap - i.today),
      detail: canExtend
        ? `Jusqu’à 10 h aujourd’hui (${2 - i.extensionsUsed} extension${i.extensionsUsed === 1 ? '' : 's'} encore possible${i.extensionsUsed === 1 ? '' : 's'} cette semaine), 9 h sinon.`
        : 'Les deux extensions à 10 h de la semaine sont utilisées : 9 h maximum.',
    },
    {
      key: 'semaine',
      label: 'Conduite de la semaine',
      remaining: clamp(56 * 60 - i.week),
      detail: '56 h au maximum du lundi 00:00 au dimanche 24:00.',
    },
    {
      key: 'deux-semaines',
      label: 'Conduite sur deux semaines',
      remaining: clamp(90 * 60 - i.week - i.lastWeek),
      detail: '90 h au maximum sur deux semaines consécutives.',
    },
  ];
  if (i.sinceRest !== undefined) {
    // Le repos journalier doit tenir dans les 24 h : il doit commencer au plus tard 24 h − 11 h (ou 9 h si réduit).
    const reducedLeft = (i.reducedUsed ?? 0) < 3;
    const latest = 24 * 60 - (reducedLeft ? 9 * 60 : 11 * 60);
    limits.push({
      key: 'amplitude',
      label: 'Avant de commencer le repos journalier',
      remaining: clamp(latest - i.sinceRest),
      detail: reducedLeft
        ? 'Le repos doit commencer au plus tard 15 h après le début de la journée (repos réduit de 9 h), 13 h pour un repos normal de 11 h.'
        : 'Les trois repos réduits sont utilisés : repos de 11 h, à commencer au plus tard 13 h après le début de la journée.',
    });
  }
  // L'amplitude est une durée d'horloge, pas de conduite : elle ne compte pas dans « prochaine limite ».
  const next = limits.filter((l) => l.key !== 'amplitude').reduce((a, b) => (b.remaining < a.remaining ? b : a));
  const todayMax = Math.min(...limits.filter((l) => l.key !== 'pause' && l.key !== 'amplitude').map((l) => l.remaining));
  return { limits, next, todayMax };
}
