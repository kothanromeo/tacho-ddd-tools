import { describe, expect, it } from 'vitest';
import { analyze, mondayOf } from '../src/lib/tacho/rules';
import { hm, localDay, localMidnight, normalize, splitDays, type Activity, type Segment } from '../src/lib/tacho/timeline';

/** Construit une chronologie à partir d'étapes [activité, durée en minutes], depuis une date UTC. */
function build(startIso: string, steps: [Activity | 'R', number][], crew = false): Segment[] {
  let t = Date.parse(startIso) / 60_000;
  const segs: Segment[] = [];
  for (const [a, d] of steps) {
    const activity: Activity = a === 'R' ? 'rest' : a;
    segs.push({ start: t, end: t + d, activity, crew, inserted: true, slot: 0 });
    t += d;
  }
  return normalize(segs);
}

const D = (h: number, m = 0) => h * 60 + m;
const rules = (a: ReturnType<typeof analyze>) => a.findings.filter((f) => f.level === 'infraction').map((f) => f.rule);

describe('Chronologie', () => {
  it('découpe en jours locaux (heure de Paris)', () => {
    const segs = build('2026-06-01T20:00:00Z', [['driving', D(4)]]);
    const days = splitDays(segs, 'Europe/Paris');
    // 20:00 UTC = 22:00 à Paris (été) : 2 h le 1er juin, 2 h le 2 juin
    expect([...days.keys()]).toEqual(['2026-06-01', '2026-06-02']);
    expect(days.get('2026-06-01')![0].end - days.get('2026-06-01')![0].start).toBe(120);
    expect(localMidnight('2026-01-15', 'Europe/Paris')).toBe(Date.parse('2026-01-14T23:00:00Z') / 60_000);
    expect(localDay(Date.parse('2026-01-14T23:30:00Z') / 60_000, 'UTC')).toBe('2026-01-14');
    expect(hm(545)).toBe('9 h 05');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
  });
});

describe('Pauses', () => {
  it('accepte 4 h 30 puis 45 min', () => {
    const a = analyze(build('2026-11-02T05:00:00Z', [['driving', 270], ['R', 45], ['driving', 270], ['R', D(14)]]), 'UTC');
    expect(rules(a)).not.toContain('pause');
  });
  it('accepte la pause fractionnée 15 + 30', () => {
    const a = analyze(build('2026-11-02T05:00:00Z', [['driving', 120], ['R', 15], ['driving', 150], ['R', 30], ['driving', 200], ['R', D(14)]]), 'UTC');
    expect(rules(a)).not.toContain('pause');
  });
  it('refuse 30 + 15 (ordre inversé) et 4 h 45 de conduite', () => {
    expect(rules(analyze(build('2026-11-02T05:00:00Z', [['driving', 120], ['R', 30], ['driving', 150], ['R', 15], ['driving', 60], ['R', D(14)]]), 'UTC'))).toContain('pause');
    expect(rules(analyze(build('2026-11-02T05:00:00Z', [['driving', 285], ['R', D(14)]]), 'UTC'))).toContain('pause');
  });
  it('ne compte pas le travail comme une pause', () => {
    expect(rules(analyze(build('2026-11-02T05:00:00Z', [['driving', 200], ['work', 60], ['driving', 100], ['R', D(14)]]), 'UTC'))).toContain('pause');
  });
});

describe('Conduite et repos journaliers', () => {
  it('journée normale sans infraction', () => {
    const a = analyze(build('2026-11-02T06:00:00Z', [['work', 30], ['driving', 240], ['R', 45], ['driving', 240], ['work', 30], ['R', D(13)], ['driving', 60], ['R', D(12)]]), 'UTC');
    expect(rules(a)).toEqual([]);
    expect(a.periods[0].restType).toBe('normal');
    expect(a.periods[0].driving).toBe(480);
  });
  it('conduite de 10 h 30 : infraction', () => {
    const a = analyze(build('2026-11-02T04:00:00Z', [['driving', 270], ['R', 45], ['driving', 270], ['R', 45], ['driving', 90], ['R', D(12)]]), 'UTC');
    expect(rules(a)).toContain('conduite-jour');
  });
  it('repos réduit de 9 h accepté, 8 h refusé', () => {
    const ok = analyze(build('2026-11-02T06:00:00Z', [['driving', 240], ['R', 60], ['driving', 240], ['work', D(4)], ['R', D(9)], ['driving', 60], ['R', D(12)]]), 'UTC');
    expect(ok.periods[0].restType).toBe('réduit');
    expect(rules(ok)).not.toContain('repos-jour');
    const ko = analyze(build('2026-11-02T06:00:00Z', [['driving', 240], ['R', 60], ['driving', 240], ['work', D(6)], ['R', D(8)], ['driving', 60], ['R', D(12)]]), 'UTC');
    expect(rules(ko)).toContain('repos-jour');
  });
  it('repos fractionné 3 h + 9 h', () => {
    const a = analyze(build('2026-11-02T05:00:00Z', [['driving', 240], ['R', D(3)], ['driving', 240], ['work', 60], ['R', D(9)], ['driving', 60], ['R', D(12)]]), 'UTC');
    expect(a.periods[0].restType).toBe('fractionné');
    expect(rules(a)).toEqual([]);
  });
  it('troisième extension à 10 h dans la semaine', () => {
    const day: [Activity | 'R', number][] = [['driving', 270], ['R', 45], ['driving', 270], ['R', 45], ['driving', 45], ['R', D(13)]];
    const steps = [...day, ...day, ...day].map((s) => [...s] as [Activity | 'R', number]);
    // ajuste chaque journée pour tomber sur 24 h : 270+45+270+45+45 = 675 min + 13 h = 1455 min
    const a = analyze(build('2026-11-02T04:00:00Z', steps), 'UTC');
    expect(a.findings.filter((f) => /Troisième journée/.test(f.message)).length).toBe(1);
  });
});

describe('Semaine et repos hebdomadaire', () => {
  it('plus de 56 h dans la semaine', () => {
    const day: [Activity | 'R', number][] = [['driving', 270], ['R', 45], ['driving', 270], ['R', D(14, 15)]];
    const steps: [Activity | 'R', number][] = [];
    for (let i = 0; i < 7; i++) steps.push(...day);
    const a = analyze(build('2026-11-02T05:00:00Z', steps), 'UTC');
    expect(rules(a)).toContain('conduite-semaine');
    expect(a.weeks[0].driving).toBeGreaterThan(56 * 60);
  });
  it('repos hebdomadaire trop tardif', () => {
    const day: [Activity | 'R', number][] = [['driving', 240], ['R', 45], ['driving', 120], ['R', D(13, 15)]];
    const steps: [Activity | 'R', number][] = [['R', D(48)]];
    for (let i = 0; i < 8; i++) steps.push(...day);
    const a = analyze(build('2026-11-01T00:00:00Z', steps), 'UTC');
    expect(rules(a)).toContain('repos-hebdo');
  });
});
