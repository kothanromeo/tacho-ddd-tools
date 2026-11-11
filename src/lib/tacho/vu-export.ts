import { writeXlsx } from '../xlsx';
import { ACTIVITY_LABELS, controlLabel, eventLabel, nationName } from './codes';
import { localDay, localTime } from './timeline';
import { CALIBRATION_PURPOSES, CARD_TYPES, drivingWithoutCard, vuSegments, type VuFile } from './vu';

/* Export Excel d'un téléchargement de véhicule. */

const frDay = (day: string) => day.split('-').reverse().join('/');
const at = (d: Date | undefined, tz: string) => (d ? `${frDay(localDay(Math.floor(+d / 60000), tz))} ${localTime(Math.floor(+d / 60000), tz)}` : undefined);
const atMin = (m: number, tz: string) => `${frDay(localDay(m, tz))} ${localTime(m, tz)}`;
const h = (min: number) => Math.round((min / 60) * 100) / 100;

export function vuXlsx(vu: VuFile, tz: string): Uint8Array {
  const sessions = vu.days.flatMap((d) => d.sessions);
  const segs = [...vuSegments(vu, 0), ...vuSegments(vu, 1)].sort((a, b) => a.start - b.start);
  return writeXlsx([
    {
      name: 'Conducteurs',
      header: ['Insertion', 'Retrait', 'Nom', 'Prénom', 'Carte', 'Pays', 'Fente', 'Km insertion', 'Km retrait', 'Distance (km)', 'Saisie manuelle'],
      widths: [18, 18, 20, 16, 20, 12, 18, 12, 12, 13, 14],
      rows: sessions.map((s) => [
        at(s.inserted, tz), at(s.withdrawn, tz), s.surname, s.firstNames, s.card.number, nationName(s.card.nation), s.slot ? 'deuxième conducteur' : 'conducteur',
        s.odometerIn, s.odometerOut, s.odometerOut >= s.odometerIn ? s.odometerOut - s.odometerIn : undefined, s.manualInput ? 'Oui' : undefined,
      ]),
    },
    {
      name: 'Activités',
      header: ['Début', 'Fin', 'Fente', 'Activité', 'Durée (h)', 'Carte insérée'],
      widths: [18, 18, 18, 16, 10, 13],
      rows: segs.map((s) => [atMin(s.start, tz), atMin(s.end, tz), s.slot ? 'deuxième conducteur' : 'conducteur', ACTIVITY_LABELS[s.activity === 'unknown' ? 'rest' : s.activity], h(s.end - s.start), s.inserted ? 'Oui' : 'Non']),
    },
    {
      name: 'Conduite sans carte',
      header: ['Début', 'Fin', 'Durée (h)'],
      widths: [18, 18, 10],
      rows: drivingWithoutCard(vu).map((s) => [atMin(s.start, tz), atMin(s.end, tz), h(s.end - s.start)]),
    },
    {
      name: 'Événements',
      header: ['Début', 'Fin', 'Nature', 'Libellé', 'Carte'],
      widths: [18, 18, 12, 52, 20],
      rows: [
        ...vu.events.map((e) => [at(e.begin, tz), at(e.end, tz), 'Événement', eventLabel(e.type), e.card.number || undefined]),
        ...vu.faults.map((e) => [at(e.begin, tz), at(e.end, tz), 'Défaut', eventLabel(e.type), e.card.number || undefined]),
        ...vu.overspeeds.map((o) => [at(o.begin, tz), at(o.end, tz), 'Excès de vitesse', `max ${o.max} km/h, moyenne ${o.avg} km/h`, o.card.number || undefined]),
        ...vu.timeAdjustments.map((x) => [at(x.oldTime, tz), at(x.newTime, tz), 'Réglage d’heure', x.workshop, x.card.number || undefined]),
        ...vu.controls.map((c) => [at(c.time, tz), undefined, 'Contrôle', controlLabel(c.type), c.card.number || undefined]),
      ],
    },
    {
      name: 'Vitesse',
      header: ['Minute', 'Vitesse max (km/h)', 'Vitesse moyenne (km/h)'],
      widths: [18, 18, 22],
      rows: vu.speedBlocks.map((b) => [at(b.begin, tz), Math.max(...b.speeds), Math.round(b.speeds.reduce((s, v) => s + v, 0) / 60)]),
    },
    {
      name: 'Étalonnages',
      header: ['Date', 'Objet', 'Atelier', 'Carte d’atelier', 'Immatriculation', 'Pneus', 'Vitesse autorisée', 'k', 'w', 'l', 'Km', 'Prochaine inspection'],
      widths: [18, 26, 26, 20, 16, 16, 16, 8, 8, 8, 10, 18],
      rows: vu.calibrations.map((c) => [
        at(c.newTime, tz), CALIBRATION_PURPOSES[c.purpose] ?? String(c.purpose), c.workshop, c.card.number || undefined, c.plate, c.tyre, c.authorisedSpeed,
        c.k, c.w, c.l, c.newOdometer, at(c.next, tz),
      ]),
    },
  ], `Véhicule ${vu.plate || vu.vin}`);
}

export const cardTypeLabel = (t: number) => CARD_TYPES[t] ?? '';
