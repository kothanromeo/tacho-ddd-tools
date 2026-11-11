import { describe, expect, it } from 'vitest';
import { DddError } from '../src/lib/tacho/bytes';
import { readCard } from '../src/lib/tacho/card';
import { eventLabel } from '../src/lib/tacho/codes';
import { sampleCard } from '../src/lib/tacho/sample';
import { drivingWithoutCard, readVu, vuChecks, vuSegments } from '../src/lib/tacho/vu';
import { sampleVu } from '../src/lib/tacho/vu-sample';

const NOW = new Date('2026-11-11T12:00:00Z');

describe('Fichier de véhicule (unité embarquée)', () => {
  const vu = readVu(sampleVu());

  it('lit la vue d’ensemble', () => {
    expect(vu.generation).toBe(1);
    expect(vu.transfers).toBe(9);
    expect(vu.vin).toBe('VF6DEMO0000000001');
    expect(vu.plate).toBe('DEMO-01');
    expect(vu.currentTime?.toISOString()).toBe('2026-11-09T07:30:00.000Z');
    expect(vu.slots).toEqual({ driver: 1, codriver: 0 });
    expect(vu.downloads[0].company).toBe('TRANSPORTS DEMO');
    expect(vu.locks[0]).toMatchObject({ company: 'TRANSPORTS DEMO', lockOut: undefined });
    expect(vu.controls[0].card.number).toBe('CTRL000000000001');
    expect(vu.warnings).toEqual([]);
  });

  it('lit les jours, les conducteurs et les lieux', () => {
    expect(vu.days.map((d) => d.date.toISOString().slice(0, 10))).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect(vu.days[2].sessions[0]).toMatchObject({ surname: 'DEMO', firstNames: 'Marie', slot: 0 });
    expect(vu.days[0].sessions[0].card.number).toBe('DEMO000000000100');
    expect(vu.days[0].odometer).toBe(412_380);
    expect(vu.days[0].places.length).toBe(2);
    const drive = vuSegments(vu, 0).filter((s) => s.activity === 'driving' && s.inserted).reduce((t, s) => t + s.end - s.start, 0);
    expect(drive).toBe(450 + 450 + 410 + 450 + 300);
  });

  it('repère la conduite sans carte', () => {
    const nc = drivingWithoutCard(vu);
    expect(nc.length).toBe(1);
    expect(nc[0].end - nc[0].start).toBe(25);
  });

  it('lit événements, excès de vitesse, vitesse détaillée et données techniques', () => {
    expect(vu.events.map((e) => eventLabel(e.type))).toEqual(['Conduite sans carte appropriée', 'Insertion de la carte pendant la conduite']);
    expect(vu.faults.length).toBe(1);
    expect(vu.overspeeds[0]).toMatchObject({ max: 97, avg: 93 });
    expect(vu.speedBlocks.length).toBe(255);
    expect(Math.max(...vu.speedBlocks.flatMap((b) => b.speeds))).toBe(98);
    expect(vu.identification).toMatchObject({ manufacturer: 'DEMO TACHYGRAPHES', serial: 123456, approval: 'e1-DEMO' });
    expect(vu.sensor?.serial).toBe(654321);
    expect(vu.calibrations.map((c) => c.purpose)).toEqual([3, 4]);
    expect(vu.calibrations[1]).toMatchObject({ tyre: '315/80 R22.5', authorisedSpeed: 90, k: 8000 });
  });

  it('établit les points d’attention', () => {
    const checks = vuChecks(vu, NOW);
    expect(checks.find((c) => c.topic === 'sans-carte')?.level).toBe('infraction');
    expect(checks.find((c) => c.topic === 'vitesse')?.message).toMatch(/97 km\/h/);
    expect(checks.find((c) => c.topic === 'etalonnage')?.message).toMatch(/10\/02\/2028/);
    expect(checks.find((c) => c.topic === 'verrou')?.level).toBe('info');
  });

  it('distingue cartes et véhicules', () => {
    expect(() => readVu(sampleCard(1))).toThrow(DddError);
    expect(() => readCard(sampleVu())).toThrow(/lecteur de fichiers véhicule/);
    expect(() => readVu(sampleVu().slice(0, 500))).toThrow(DddError);
  });
});
