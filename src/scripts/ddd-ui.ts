import { cardSegments, fullName, readCard, type DriverCard } from '../lib/tacho/card';
import { ACTIVITY_LABELS, controlLabel, ENTRY_TYPES, eventLabel, nationName, nationSign, SERIOUS_EVENTS, SPECIFIC_CONDITIONS } from '../lib/tacho/codes';
import { analyze, type Analysis, type Finding } from '../lib/tacho/rules';
import { hm, localDay, localMidnight, localTime, normalize, type Segment } from '../lib/tacho/timeline';
import { bindThanks, thanksCard, waitCard } from './creator';
import { bindDrop, download, esc, XLSX_TYPE } from './ui';

const TZ_KEY = 'tacho:fuseau';
const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const frDay = (day: string) => day.split('-').reverse().join('/');
const minOf = (d: Date) => Math.floor(+d / 60000);
const when = (d: Date | undefined, tz: string) => (d ? `${frDay(localDay(minOf(d), tz))} ${localTime(minOf(d), tz)}` : '—');
const plate = (nation: number, p: string) => esc(`${nationSign(nation) ? nationSign(nation) + ' ' : ''}${p}`);

interface State {
  card: DriverCard;
  segs: Segment[];
  tz: string;
  a: Analysis;
  fileName: string;
  tab: string;
}

function timeline(segs: Segment[], dayStart: number, findings: Finding[], tz: string): string {
  const spans = segs.map((s) => {
    const left = ((s.start - dayStart) / 1440) * 100;
    const width = ((s.end - s.start) / 1440) * 100;
    const label = `${ACTIVITY_LABELS[s.activity]} ${localTime(s.start, tz)}–${localTime(s.end, tz)} (${hm(s.end - s.start)})${s.crew ? ', équipage' : ''}${!s.inserted && s.activity !== 'unknown' ? ', saisie manuelle' : ''}`;
    return `<span class="a-${s.activity}${!s.inserted && s.activity !== 'unknown' ? ' manual' : ''}" style="left:${left.toFixed(3)}%;width:${Math.max(width, 0.07).toFixed(3)}%" title="${esc(label)}"></span>`;
  }).join('');
  const marks = findings.map((f) => `<i class="mark ${f.level}" style="left:${(((f.at - dayStart) / 1440) * 100).toFixed(2)}%" title="${esc(f.message)}"></i>`).join('');
  return `<div class="tl">${spans}${marks}</div>`;
}

function findingsHtml(a: Analysis, tz: string): string {
  const inf = a.findings.filter((f) => f.level === 'infraction');
  const warn = a.findings.filter((f) => f.level === 'warning');
  if (!a.findings.length) {
    return '<div class="banner ok"><div><strong>Aucune infraction probable détectée</strong><p>Pauses, conduite journalière et hebdomadaire, repos journaliers et hebdomadaires respectent les limites sur la période lue.</p></div></div>';
  }
  const li = (f: Finding) => `<li class="${f.level === 'infraction' ? 'error' : f.level}"><span class="ic">${f.level === 'infraction' ? '✕' : '!'}</span><div><strong>${frDay(localDay(f.at, tz))}</strong> · ${esc(f.message)}</div><span class="rule">${f.rule}</span></li>`;
  return `${inf.length ? `<h3 class="checks-group">${inf.length} infraction${inf.length > 1 ? 's' : ''} probable${inf.length > 1 ? 's' : ''}</h3><ul class="checks">${inf.map(li).join('')}</ul>` : ''}
    ${warn.length ? `<h3 class="checks-group">${warn.length} point${warn.length > 1 ? 's' : ''} à vérifier</h3><ul class="checks">${warn.map(li).join('')}</ul>` : ''}`;
}

function daysHtml(st: State): string {
  const byDay = new Map<string, Finding[]>();
  for (const f of st.a.findings) {
    const d = localDay(f.at, st.tz);
    byDay.set(d, [...(byDay.get(d) ?? []), f]);
  }
  const km = new Map(st.card.days.map((d) => [d.date.toISOString().slice(0, 10), d.distance]));
  const rows = [...st.a.days].reverse().map((d) => {
    const start = localMidnight(d.day, st.tz);
    const f = byDay.get(d.day) ?? [];
    const wd = WEEKDAYS[new Date(d.day + 'T12:00:00Z').getUTCDay()];
    return `<tr class="${f.some((x) => x.level === 'infraction') ? 'row-err' : f.length ? 'row-warn' : ''}">
      <td class="nowrap"><strong>${wd} ${frDay(d.day)}</strong>${f.length ? `<br><small class="neg">${f.length} constat${f.length > 1 ? 's' : ''}</small>` : ''}</td>
      <td class="tl-cell">${timeline(d.segments, start, f, st.tz)}</td>
      <td class="num">${d.driving ? hm(d.driving) : ''}</td><td class="num">${d.work ? hm(d.work) : ''}</td><td class="num">${d.available ? hm(d.available) : ''}</td>
      <td class="num">${d.first !== undefined ? `${localTime(d.first, st.tz)}–${localTime(d.last!, st.tz)}` : ''}</td>
      <td class="num">${km.get(d.day) ? km.get(d.day) + ' km' : ''}</td></tr>`;
  }).join('');
  return `<div class="legend"><span class="a-driving"></span>Conduite <span class="a-work"></span>Travail <span class="a-available"></span>Disponibilité <span class="a-rest"></span>Repos <span class="a-unknown"></span>Carte retirée <span class="a-rest manual"></span>Saisie manuelle</div>
    <div class="table-wrap"><table class="days"><thead><tr><th>Jour</th><th class="tl-head"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></th><th class="num">Conduite</th><th class="num">Travail</th><th class="num">Dispo.</th><th class="num">Amplitude</th><th class="num">Distance</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Survolez la frise pour le détail de chaque activité. Les périodes « carte retirée » sont comptées comme du repos dans l’analyse.</p>`;
}

function weeksHtml(a: Analysis): string {
  return `<div class="table-wrap"><table><thead><tr><th>Semaine du</th><th class="num">Conduite</th><th>Sur 56 h</th><th class="num">Jours au-delà de 9 h</th></tr></thead><tbody>${[...a.weeks].reverse().map((w) => {
    const pct = Math.min(100, (w.driving / (56 * 60)) * 100);
    return `<tr class="${w.driving > 56 * 60 ? 'row-err' : ''}"><td>${frDay(w.monday)}</td><td class="num">${hm(w.driving)}</td><td><div class="gauge"><span style="width:${pct.toFixed(1)}%" class="${w.driving > 56 * 60 ? 'over' : ''}"></span></div></td><td class="num">${w.extendedDays || ''}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function vehiclesHtml(c: DriverCard, tz: string): string {
  if (!c.vehicles.length) return '<p>Aucun véhicule enregistré.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Immatriculation</th><th>Première utilisation</th><th>Dernière utilisation</th><th class="num">Km début</th><th class="num">Km fin</th><th class="num">Distance</th>${c.generation === 2 ? '<th>VIN</th>' : ''}</tr></thead><tbody>${[...c.vehicles].reverse().map((v) => `<tr>
    <td class="mono">${plate(v.nation, v.plate)}</td><td>${when(v.firstUse, tz)}</td><td>${when(v.lastUse, tz)}</td><td class="num">${v.odometerBegin.toLocaleString('fr-FR')}</td><td class="num">${v.odometerEnd.toLocaleString('fr-FR')}</td>
    <td class="num">${v.odometerEnd >= v.odometerBegin ? (v.odometerEnd - v.odometerBegin).toLocaleString('fr-FR') + ' km' : ''}</td>${c.generation === 2 ? `<td class="mono">${esc(v.vin ?? '')}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

function placesHtml(c: DriverCard, tz: string): string {
  if (!c.places.length) return '<p>Aucun lieu enregistré.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Saisie</th><th>Pays</th><th class="num">Km</th><th>Position</th></tr></thead><tbody>${[...c.places].reverse().map((p) => `<tr>
    <td>${when(p.time, tz)}</td><td>${esc(ENTRY_TYPES[p.entryType] ?? p.entryType)}</td><td>${esc(nationName(p.country))}</td><td class="num">${p.odometer.toLocaleString('fr-FR')}</td>
    <td>${p.lat !== undefined ? `<a href="https://www.openstreetmap.org/?mlat=${p.lat.toFixed(5)}&amp;mlon=${p.lon!.toFixed(5)}#map=12/${p.lat.toFixed(4)}/${p.lon!.toFixed(4)}" target="_blank" rel="noopener">${p.lat.toFixed(4)}, ${p.lon!.toFixed(4)}</a>` : ''}</td></tr>`).join('')}</tbody></table></div>
    ${c.borderCrossings.length ? `<h3>Passages de frontière</h3><div class="table-wrap"><table><thead><tr><th>Date</th><th>Quitté</th><th>Entré</th><th class="num">Km</th></tr></thead><tbody>${c.borderCrossings.map((b) => `<tr><td>${when(b.time, tz)}</td><td>${esc(nationName(b.countryLeft))}</td><td>${esc(nationName(b.countryEntered))}</td><td class="num">${b.odometer.toLocaleString('fr-FR')}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}

function eventsHtml(c: DriverCard, tz: string): string {
  const rows = [
    ...c.events.map((e) => ({ t: e.begin, html: `<td>${when(e.begin, tz)}</td><td>Événement</td><td>${SERIOUS_EVENTS.has(e.type) ? '<strong>' : ''}${esc(eventLabel(e.type))}${SERIOUS_EVENTS.has(e.type) ? '</strong>' : ''}${e.end ? `<br><small>jusqu’au ${when(e.end, tz)}</small>` : ''}</td><td class="mono">${plate(e.nation, e.plate)}</td>` })),
    ...c.faults.map((e) => ({ t: e.begin, html: `<td>${when(e.begin, tz)}</td><td>Défaut</td><td>${esc(eventLabel(e.type))}</td><td class="mono">${plate(e.nation, e.plate)}</td>` })),
    ...c.controls.map((k) => ({ t: k.time, html: `<td>${when(k.time, tz)}</td><td>Contrôle</td><td>${esc(controlLabel(k.type))}${k.periodBegin ? `<br><small>période contrôlée : ${when(k.periodBegin, tz)} → ${when(k.periodEnd, tz)}</small>` : ''}</td><td class="mono">${plate(k.nation, k.plate)}</td>` })),
    ...c.conditions.map((k) => ({ t: k.time, html: `<td>${when(k.time, tz)}</td><td>Condition</td><td>${esc(SPECIFIC_CONDITIONS[k.type] ?? String(k.type))}</td><td></td>` })),
  ].sort((x, y) => +(y.t ?? 0) - +(x.t ?? 0));
  if (!rows.length) return '<p>Aucun événement, défaut ni contrôle enregistré.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Nature</th><th>Détail</th><th>Véhicule</th></tr></thead><tbody>${rows.map((r) => `<tr>${r.html}</tr>`).join('')}</tbody></table></div>`;
}

function render(st: State): string {
  const c = st.card;
  const a = st.a;
  const inf = a.findings.filter((f) => f.level === 'infraction').length;
  const first = a.days[0]?.day;
  const last = a.days[a.days.length - 1]?.day;
  const driving = a.days.reduce((t, d) => t + d.driving, 0);
  const distance = c.days.reduce((t, d) => t + d.distance, 0);
  const now = new Date();
  const expired = c.expiry && c.expiry < now;
  const lastActivity = c.days.length ? c.days[c.days.length - 1].date : undefined;
  const downloadLate = c.lastDownload && lastActivity && (+lastActivity - +c.lastDownload) / 86_400_000 > 28;
  const tabs: [string, string, string][] = [
    ['constats', `Constats${a.findings.length ? ` (${a.findings.length})` : ''}`, findingsHtml(a, st.tz) + '<p class="hint">Analyse indicative selon le règlement (CE) 561/2006 : elle ne tient pas compte des ferries et trains, des dérogations nationales ni des circonstances exceptionnelles, et ne remplace pas un logiciel d’analyse agréé.</p>'],
    ['jours', `Jour par jour (${a.days.length})`, daysHtml(st)],
    ['semaines', 'Semaines', weeksHtml(a)],
    ['vehicules', `Véhicules (${c.vehicles.length})`, vehiclesHtml(c, st.tz)],
    ['lieux', `Lieux (${c.places.length})`, placesHtml(c, st.tz)],
    ['evenements', `Événements (${c.events.length + c.faults.length + c.controls.length})`, eventsHtml(c, st.tz)],
  ];
  return `<div class="banner ${inf ? 'err' : 'ok'}"><div><strong>${esc(fullName(c) || 'Conducteur')}</strong>
      <p>Carte ${esc(nationSign(c.cardNation))} n° <span class="mono">${esc(c.cardNumber)}</span> · ${c.generation === 2 ? (c.version2 ? 'carte intelligente V2' : 'carte de 2e génération') : 'carte de 1re génération'} · valable jusqu’au ${c.expiry ? frDay(c.expiry.toISOString().slice(0, 10)) : '—'}${expired ? ' <strong>(expirée)</strong>' : ''}</p></div></div>
    <div class="stats">
      <div class="stat"><span class="stat-label">Période lue</span><strong>${first ? `${frDay(first)} → ${frDay(last!)}` : '—'}</strong><span class="stat-sub">${c.days.length} jours enregistrés</span></div>
      <div class="stat"><span class="stat-label">Conduite totale</span><strong>${hm(driving)}</strong><span class="stat-sub">${distance.toLocaleString('fr-FR')} km</span></div>
      <div class="stat"><span class="stat-label">Infractions probables</span><strong class="${inf ? 'neg' : 'pos'}">${inf}</strong><span class="stat-sub">${a.findings.length - inf} point(s) à vérifier</span></div>
      <div class="stat"><span class="stat-label">Dernier téléchargement</span><strong>${c.lastDownload ? frDay(c.lastDownload.toISOString().slice(0, 10)) : 'inconnu'}</strong><span class="stat-sub">${downloadLate ? '<span class="neg">plus de 28 jours avant la dernière activité</span>' : 'à refaire au plus tard tous les 28 jours'}</span></div>
    </div>
    ${c.warnings.length ? `<div class="notice">${c.warnings.map(esc).join('<br>')}</div>` : ''}
    <div class="export-bar">
      <span class="export-title">Exporter :</span><button type="button" class="btn" data-xlsx>Excel (.xlsx)</button>
      <label class="tz">Heures affichées <select data-tz><option value="Europe/Paris" ${st.tz !== 'UTC' ? 'selected' : ''}>heure de Paris</option><option value="UTC" ${st.tz === 'UTC' ? 'selected' : ''}>UTC (heure de la carte)</option></select></label>
    </div>
    ${thanksCard('analyse')}
    <div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${st.tab === id}">${label}</button>`).join('')}</div>
    ${tabs.map(([id, , html]) => `<div class="panel" data-panel="${id}" ${st.tab === id ? '' : 'hidden'}>${html}</div>`).join('')}
    <div class="btn-row" style="margin-top:1.2rem"><button type="button" class="btn ghost" data-reset>Lire un autre fichier</button><span class="hint">Fichier : ${esc(st.fileName)} · ${c.signatures} bloc(s) signé(s) (signature non vérifiée)</span></div>`;
}

export function mountDdd(root: HTMLElement) {
  const drop = root.querySelector<HTMLElement>('[data-drop]')!;
  const out = root.querySelector<HTMLElement>('[data-result]')!;
  let st: State | undefined;
  let tz = 'Europe/Paris';
  try {
    tz = localStorage.getItem(TZ_KEY) === 'UTC' ? 'UTC' : 'Europe/Paris';
  } catch {
    /* stockage indisponible */
  }

  const paint = () => {
    if (!st) return;
    out.innerHTML = render(st);
    bindThanks(out);
    out.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      st!.tab = b.dataset.tab!;
      out.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      out.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== st!.tab));
    }));
    out.querySelector<HTMLSelectElement>('[data-tz]')!.addEventListener('change', (e) => {
      tz = (e.target as HTMLSelectElement).value;
      try { localStorage.setItem(TZ_KEY, tz); } catch { /* sans importance */ }
      st = { ...st!, tz, a: analyze(st!.segs, tz) };
      paint();
    });
    out.querySelector('[data-xlsx]')!.addEventListener('click', async () => {
      const { cardXlsx } = await import('../lib/tacho/export');
      const first = st!.a.days[0]?.day ?? 'carte';
      download(cardXlsx(st!.card, st!.a, st!.tz), `carte-${(st!.card.surname || 'conducteur').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${first}.xlsx`, XLSX_TYPE);
    });
    out.querySelector('[data-reset]')!.addEventListener('click', () => {
      out.hidden = true;
      drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const show = (bytes: Uint8Array, fileName: string) => {
    out.hidden = false;
    out.innerHTML = waitCard('Lecture de la carte…');
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      try {
        const card = readCard(bytes);
        const segs = normalize(cardSegments(card));
        st = { card, segs, tz, a: analyze(segs, tz), fileName, tab: 'constats' };
        paint();
      } catch (e) {
        out.innerHTML = `<div class="banner err"><div><strong>Lecture impossible</strong><p>${esc(e instanceof Error ? e.message : e)}</p></div></div>`;
      }
    }, 20);
  };

  bindDrop(drop, root.querySelector('[data-file]')!, async (file) => show(new Uint8Array(await file.arrayBuffer()), file.name));
  root.querySelector('[data-sample]')!.addEventListener('click', async () => {
    const { sampleCard } = await import('../lib/tacho/sample');
    show(sampleCard(2), 'carte-fictive-exemple.ddd');
  });
}
