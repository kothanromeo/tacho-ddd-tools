import { describe, expect, it } from 'vitest';
import { DddError, decodeText } from '../src/lib/tacho/bytes';
import { cardSegments, readCard } from '../src/lib/tacho/card';
import { eventLabel, nationName } from '../src/lib/tacho/codes';
import { remaining } from '../src/lib/tacho/remaining';
import { analyze } from '../src/lib/tacho/rules';
import { sampleCard, samplePlan } from '../src/lib/tacho/sample';
import { normalize } from '../src/lib/tacho/timeline';

const NOW = new Date('2026-11-11T12:00:00Z');

describe('Lecture d’une carte conducteur', () => {
  for (const gen of [1, 2] as const) {
    it(`génération ${gen} : identité, activités, véhicules, lieux`, () => {
      const card = readCard(sampleCard(gen));
      expect(card.generation).toBe(gen);
      expect(card.surname).toBe('EXEMPLE');
      expect(card.firstNames).toBe('Jean');
      expect(card.cardNumber).toBe('DEMO000000000100');
      expect(nationName(card.cardNation)).toBe('France');
      expect(card.birthDate).toBe('1980-01-01');
      expect(card.expiry?.toISOString()).toBe('2029-02-28T23:59:59.000Z');
      expect(card.licence?.number).toBe('DEMO-PERMIS-0001');
      expect(card.days.length).toBe(samplePlan().length);
      expect(card.days[0].date.toISOString()).toBe('2026-10-05T00:00:00.000Z');
      expect(card.vehicles.map((v) => v.plate)).toEqual(['DEMO-01', 'DEMO-02']);
      expect(card.places.length).toBe(samplePlan().length * 2);
      expect(card.events.map((e) => eventLabel(e.type))).toEqual(['Insertion de la carte pendant la conduite']);
      expect(card.faults.length).toBe(1);
      expect(card.controls[0].cardNumber).toBe('CTRL000000000001');
      expect(card.conditions[0].type).toBe(3);
      expect(card.lastDownload?.toISOString()).toBe('2026-11-02T08:00:00.000Z');
      expect(card.warnings).toEqual([]);
      if (gen === 2) {
        expect(card.vehicles[0].vin).toBe('VF6DEMO0000000001');
        expect(card.places[0].lat).toBeCloseTo(45.75, 5);
        expect(card.places[0].lon).toBeCloseTo(4.8333, 3);
      }
    });
  }

  it('suit le tampon circulaire quand il reboucle', () => {
    const plain = readCard(sampleCard(1));
    const wrapped = readCard(sampleCard(1, { activityLength: 1500, offset: 1400 }));
    expect(wrapped.days.length).toBe(plain.days.length);
    expect(wrapped.days.map((d) => d.changes.length)).toEqual(plain.days.map((d) => d.changes.length));
  });

  it('décode les saisies manuelles et les retraits de carte', () => {
    const card = readCard(sampleCard(1));
    expect(card.days[5].changes[0]).toMatchObject({ activity: 'rest', inserted: false, manual: true });
    expect(card.days[0].changes[0]).toMatchObject({ activity: 'unknown', inserted: false });
    expect(card.days[0].changes.at(-1)).toMatchObject({ activity: 'unknown', inserted: false });
  });

  it('refuse les fichiers qui ne sont pas des cartes', () => {
    expect(() => readCard(new Uint8Array([0x76, 0x01, 0, 0, 0, 0]))).toThrow(/véhicule/);
    expect(() => readCard(new TextEncoder().encode('Bonjour, ceci est un texte.'))).toThrow(DddError);
    expect(() => readCard(sampleCard(1).slice(0, 300))).toThrow(DddError);
  });

  it('décode les pages de code', () => {
    expect(decodeText(new Uint8Array([0x4c, 0xe9, 0x61, 0x20, 0x20]), 1)).toBe('Léa');
    expect(decodeText(new Uint8Array([0xff, 0xff]), 1)).toBe('');
  });
});

describe('Analyse de la carte d’exemple', () => {
  it('trouve les trois écarts volontaires, et seulement eux', () => {
    const card = readCard(sampleCard(2));
    const a = analyze(normalize(cardSegments(card, NOW)), 'UTC');
    const infractions = a.findings.filter((f) => f.level === 'infraction');
    expect(infractions.map((f) => f.rule).sort()).toEqual(['conduite-jour', 'pause', 'repos-jour']);
    expect(infractions.find((f) => f.rule === 'conduite-jour')!.message).toMatch(/10 h 40/);
    expect(infractions.find((f) => f.rule === 'repos-jour')!.message).toMatch(/8 h 30/);
    expect(infractions.find((f) => f.rule === 'pause')!.message).toMatch(/4 h 50/);
    expect(a.weeks.length).toBe(4);
  });
});

describe('Temps de conduite restant', () => {
  it('prend la contrainte la plus serrée', () => {
    const r = remaining({ sinceBreak: 200, split15: false, today: 400, extensionsUsed: 0, week: 40 * 60, lastWeek: 45 * 60 });
    expect(r.next.key).toBe('pause');
    expect(r.next.remaining).toBe(70);
    expect(r.todayMax).toBe(200);
    const r2 = remaining({ sinceBreak: 0, split15: false, today: 100, extensionsUsed: 2, week: 55 * 60, lastWeek: 30 * 60, sinceRest: 600 });
    expect(r2.next.key).toBe('semaine');
    expect(r2.next.remaining).toBe(60);
    expect(r2.limits.find((l) => l.key === 'amplitude')!.remaining).toBe(300);
  });
});
