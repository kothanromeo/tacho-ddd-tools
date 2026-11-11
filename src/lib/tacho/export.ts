import { writeXlsx } from '../xlsx';
import { fullName, type DriverCard } from './card';
import { ACTIVITY_LABELS, controlLabel, ENTRY_TYPES, eventLabel, nationName, nationSign, SPECIFIC_CONDITIONS } from './codes';
import type { Analysis } from './rules';
import { localDay, localTime } from './timeline';

/* Export Excel d'une carte lue et de son analyse. Durées en heures décimales, pour pouvoir les additionner. */

const h = (min: number) => Math.round((min / 60) * 100) / 100;
const dt = (d: Date | undefined, tz: string) => (d ? `${frDay(localDay(Math.floor(+d / 60000), tz))} ${localTime(Math.floor(+d / 60000), tz)}` : undefined);
const frDay = (day: string) => day.split('-').reverse().join('/');
const plate = (nation: number, p: string) => (p ? `${nationSign(nation) ? nationSign(nation) + ' ' : ''}${p}` : undefined);

export function cardXlsx(card: DriverCard, a: Analysis, tz: string): Uint8Array {
  const tzLabel = tz === 'UTC' ? 'UTC' : 'heure de Paris';
  return writeXlsx([
    {
      name: 'Jours',
      header: ['Date', 'Conduite (h)', 'Travail (h)', 'Disponibilité (h)', 'Repos (h)', 'Carte retirée (h)', 'Début', 'Fin', 'Équipage'],
      widths: [12, 12, 11, 15, 10, 16, 8, 8, 10],
      rows: a.days.map((d) => [
        { date: d.day }, h(d.driving), h(d.work), h(d.available), h(d.rest), h(d.unknown),
        d.first !== undefined ? localTime(d.first, tz) : undefined, d.last !== undefined ? localTime(d.last, tz) : undefined, d.crew ? 'Oui' : undefined,
      ]),
    },
    {
      name: 'Activités',
      header: [`Début (${tzLabel})`, `Fin (${tzLabel})`, 'Activité', 'Durée (h)', 'Carte', 'Équipage', 'Fente'],
      widths: [18, 18, 22, 10, 18, 10, 14],
      rows: a.days.flatMap((d) => d.segments.map((s) => [
        `${frDay(d.day)} ${localTime(s.start, tz)}`, `${frDay(localDay(s.end, tz))} ${localTime(s.end, tz)}`,
        ACTIVITY_LABELS[s.activity], h(s.end - s.start), s.inserted ? 'insérée' : s.activity === 'unknown' ? 'retirée' : 'saisie manuelle',
        s.crew ? 'Oui' : undefined, s.slot ? 'deuxième conducteur' : 'conducteur',
      ])),
    },
    {
      name: 'Infractions probables',
      header: ['Date', 'Niveau', 'Règle', 'Constat'],
      widths: [12, 14, 20, 110],
      rows: a.findings.map((f) => [{ date: localDay(f.at, tz) }, f.level === 'infraction' ? 'Infraction probable' : f.level === 'warning' ? 'À vérifier' : 'Information', f.rule, f.message]),
    },
    {
      name: 'Semaines',
      header: ['Semaine du', 'Conduite (h)', 'Journées au-delà de 9 h'],
      widths: [12, 12, 22],
      rows: a.weeks.map((w) => [{ date: w.monday }, h(w.driving), w.extendedDays || undefined]),
    },
    {
      name: 'Véhicules',
      header: ['Première utilisation', 'Dernière utilisation', 'Immatriculation', 'Pays', 'Km début', 'Km fin', 'Distance (km)', 'VIN'],
      widths: [18, 18, 16, 14, 10, 10, 13, 20],
      rows: card.vehicles.map((v) => [
        dt(v.firstUse, tz), dt(v.lastUse, tz), v.plate, nationName(v.nation), v.odometerBegin, v.odometerEnd,
        v.odometerEnd >= v.odometerBegin ? v.odometerEnd - v.odometerBegin : undefined, v.vin || undefined,
      ]),
    },
    {
      name: 'Lieux',
      header: ['Date', 'Type', 'Pays', 'Km', 'Latitude', 'Longitude'],
      widths: [18, 30, 16, 10, 10, 10],
      rows: card.places.map((p) => [dt(p.time, tz), ENTRY_TYPES[p.entryType] ?? String(p.entryType), nationName(p.country), p.odometer, p.lat, p.lon]),
    },
    {
      name: 'Événements et défauts',
      header: ['Début', 'Fin', 'Nature', 'Libellé', 'Véhicule'],
      widths: [18, 18, 10, 52, 18],
      rows: [
        ...card.events.map((e) => [dt(e.begin, tz), dt(e.end, tz), 'Événement', eventLabel(e.type), plate(e.nation, e.plate)]),
        ...card.faults.map((e) => [dt(e.begin, tz), dt(e.end, tz), 'Défaut', eventLabel(e.type), plate(e.nation, e.plate)]),
        ...card.conditions.map((c) => [dt(c.time, tz), undefined, 'Condition', SPECIFIC_CONDITIONS[c.type] ?? String(c.type), undefined]),
        ...card.controls.map((c) => [dt(c.time, tz), undefined, 'Contrôle', controlLabel(c.type), plate(c.nation, c.plate)]),
      ],
    },
  ], `Carte conducteur ${fullName(card)}`);
}
