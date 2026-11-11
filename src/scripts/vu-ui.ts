import { ACTIVITY_LABELS, controlLabel, eventLabel, nationName, nationSign, SERIOUS_EVENTS } from '../lib/tacho/codes';
import { hm, localDay, localMidnight, localTime, normalize, splitDays, type Segment } from '../lib/tacho/timeline';
import { CALIBRATION_PURPOSES, CARD_TYPES, drivingWithoutCard, readVu, SLOT_STATUS, vuChecks, vuDistance, vuSegments, type VuFile } from '../lib/tacho/vu';
import { bindThanks, thanksCard, waitCard } from './creator';
import { bindDrop, download, esc, XLSX_TYPE } from './ui';

const TZ_KEY = 'tacho:fuseau';
const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const frDay = (day: string) => day.split('-').reverse().join('/');
const minOf = (d: Date) => Math.floor(+d / 60000);
const when = (d: Date | undefined, tz: string) => (d ? `${frDay(localDay(minOf(d), tz))} ${localTime(minOf(d), tz)}` : '—');
const km = (n: number) => `${n.toLocaleString('fr-FR')} km`;

interface State {
  vu: VuFile;
  tz: string;
  fileName: string;
  tab: string;
}

function bar(segs: Segment[], dayStart: number, tz: string, label: string): string {
  const spans = segs.map((s) => {
    const noCard = !s.inserted && s.activity === 'driving';
    const cls = noCard ? 'a-nocard' : `a-${s.activity === 'unknown' ? 'rest' : s.activity}`;
    const title = `${label} · ${noCard ? 'Conduite sans carte' : ACTIVITY_LABELS[s.activity === 'unknown' ? 'rest' : s.activity]} ${localTime(s.start, tz)}–${localTime(s.end, tz)} (${hm(s.end - s.start)})${s.inserted ? '' : noCard ? '' : ', sans carte'}`;
    return `<span class="${cls}${!s.inserted && !noCard ? ' faded' : ''}" style="left:${(((s.start - dayStart) / 1440) * 100).toFixed(3)}%;width:${Math.max(((s.end - s.start) / 1440) * 100, 0.07).toFixed(3)}%" title="${esc(title)}"></span>`;
  }).join('');
  return `<div class="tl tl-slim">${spans}</div>`;
}

function daysHtml(st: State): string {
  const { vu, tz } = st;
  const d0 = splitDays(normalize(vuSegments(vu, 0)), tz);
  const d1 = splitDays(normalize(vuSegments(vu, 1)), tz);
  const days = [...new Set([...d0.keys(), ...d1.keys()])].sort().reverse();
  const sessionsByDay = new Map<string, string[]>();
  for (const d of vu.days) {
    for (const s of d.sessions) {
      if (!s.inserted) continue;
      const k = localDay(minOf(s.inserted), tz);
      const who = `${esc([s.firstNames, s.surname].filter(Boolean).join(' ') || s.card.number || 'carte')} <small>${localTime(minOf(s.inserted), tz)}${s.withdrawn ? `–${localTime(minOf(s.withdrawn), tz)}` : ''}${s.slot ? ' · 2e conducteur' : ''}</small>`;
      sessionsByDay.set(k, [...(sessionsByDay.get(k) ?? []), who]);
    }
  }
  const rows = days.map((day) => {
    const start = localMidnight(day, tz);
    const s0 = d0.get(day) ?? [];
    const s1 = d1.get(day) ?? [];
    const drive = s0.filter((s) => s.activity === 'driving').reduce((t, s) => t + s.end - s.start, 0);
    const noCard = s0.filter((s) => s.activity === 'driving' && !s.inserted).reduce((t, s) => t + s.end - s.start, 0);
    const wd = WEEKDAYS[new Date(day + 'T12:00:00Z').getUTCDay()];
    return `<tr class="${noCard ? 'row-err' : ''}">
      <td class="nowrap"><strong>${wd} ${frDay(day)}</strong></td>
      <td class="tl-cell">${bar(s0, start, tz, 'Conducteur')}${s1.some((s) => s.activity !== 'rest') ? bar(s1, start, tz, 'Deuxième conducteur') : ''}</td>
      <td class="num">${drive ? hm(drive) : ''}${noCard ? `<br><small class="neg">dont ${hm(noCard)} sans carte</small>` : ''}</td>
      <td class="drivers">${(sessionsByDay.get(day) ?? []).join('<br>') || '<span class="hint">aucune carte</span>'}</td></tr>`;
  }).join('');
  return `<div class="legend"><span class="a-driving"></span>Conduite <span class="a-nocard"></span>Conduite sans carte <span class="a-work"></span>Travail <span class="a-available"></span>Disponibilité <span class="a-rest"></span>Repos</div>
    <div class="table-wrap"><table class="days"><thead><tr><th>Jour</th><th class="tl-head"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></th><th class="num">Conduite</th><th>Cartes insérées</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Frise du haut : fente conducteur ; frise du bas (si présente) : fente du deuxième conducteur. Survolez pour le détail.</p>`;
}

function driversHtml(st: State): string {
  const sessions = st.vu.days.flatMap((d) => d.sessions).filter((s) => s.inserted).sort((a, b) => +b.inserted! - +a.inserted!);
  if (!sessions.length) return '<p>Aucune insertion de carte enregistrée.</p>';
  const byCard = new Map<string, { name: string; count: number; km: number; last?: Date }>();
  for (const s of sessions) {
    const key = s.card.number || `${s.surname} ${s.firstNames}`;
    const e = byCard.get(key) ?? { name: [s.firstNames, s.surname].filter(Boolean).join(' '), count: 0, km: 0, last: s.inserted };
    e.count++;
    if (s.odometerOut >= s.odometerIn) e.km += s.odometerOut - s.odometerIn;
    byCard.set(key, e);
  }
  return `<h3>Synthèse par carte</h3><div class="table-wrap"><table><thead><tr><th>Conducteur</th><th>Carte</th><th class="num">Insertions</th><th class="num">Distance</th><th>Dernière insertion</th></tr></thead><tbody>${[...byCard].map(([k, e]) => `<tr><td>${esc(e.name || '—')}</td><td class="mono">${esc(k)}</td><td class="num">${e.count}</td><td class="num">${km(e.km)}</td><td>${when(e.last, st.tz)}</td></tr>`).join('')}</tbody></table></div>
    <h3>Toutes les insertions</h3><div class="table-wrap"><table><thead><tr><th>Insertion</th><th>Retrait</th><th>Conducteur</th><th>Fente</th><th class="num">Km</th><th class="num">Distance</th></tr></thead><tbody>${sessions.map((s) => `<tr>
      <td>${when(s.inserted, st.tz)}</td><td>${when(s.withdrawn, st.tz)}</td><td>${esc([s.firstNames, s.surname].filter(Boolean).join(' ') || '—')}${s.manualInput ? ' <small>(saisie manuelle)</small>' : ''}<br><small class="mono">${esc(nationSign(s.card.nation))} ${esc(s.card.number)}</small></td>
      <td>${s.slot ? 'deuxième conducteur' : 'conducteur'}</td><td class="num">${s.odometerIn.toLocaleString('fr-FR')} → ${s.odometerOut.toLocaleString('fr-FR')}</td><td class="num">${s.odometerOut >= s.odometerIn ? km(s.odometerOut - s.odometerIn) : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

function speedHtml(st: State): string {
  const { vu, tz } = st;
  const blocks = vu.speedBlocks;
  const os = vu.overspeeds.length
    ? `<h3>Excès de vitesse</h3><div class="table-wrap"><table><thead><tr><th>Début</th><th>Fin</th><th class="num">Maximum</th><th class="num">Moyenne</th><th>Carte</th></tr></thead><tbody>${vu.overspeeds.map((o) => `<tr><td>${when(o.begin, tz)}</td><td>${when(o.end, tz)}</td><td class="num"><strong>${o.max} km/h</strong></td><td class="num">${o.avg} km/h</td><td class="mono">${esc(o.card.number)}</td></tr>`).join('')}</tbody></table></div>`
    : '<p>Aucun excès de vitesse enregistré.</p>';
  if (!blocks.length) return `<p>Aucune vitesse détaillée dans ce fichier.</p>${os}`;
  const t0 = minOf(blocks[0].begin);
  const t1 = minOf(blocks[blocks.length - 1].begin) + 1;
  const span = Math.max(t1 - t0, 1);
  const W = 1000, H = 260, top = 10, bottom = 30, vmax = 130;
  const x = (m: number) => ((m - t0) / span) * W;
  const y = (v: number) => top + (1 - Math.min(v, vmax) / vmax) * (H - top - bottom);
  const paths: string[] = [];
  let cur = '';
  let prev = -2;
  for (const b of blocks) {
    const m = minOf(b.begin);
    if (m !== prev + 1 && cur) { paths.push(cur); cur = ''; }
    for (let s = 0; s < 60; s += 10) {
      const v = Math.max(...b.speeds.slice(s, s + 10));
      cur += `${cur ? 'L' : 'M'}${x(m + s / 60).toFixed(1)} ${y(v).toFixed(1)}`;
    }
    prev = m;
  }
  if (cur) paths.push(cur);
  const ticks: string[] = [];
  const step = span > 600 ? 120 : 60;
  for (let m = Math.ceil(t0 / step) * step; m <= t1; m += step) ticks.push(`<text x="${x(m).toFixed(1)}" y="${H - 10}" text-anchor="middle">${localTime(m, tz)}</text>`);
  const max = blocks.reduce((m, b) => b.speeds.reduce((mm, v) => (v > mm ? v : mm), m), 0);
  const over90 = blocks.reduce((t, b) => t + b.speeds.filter((v) => v > 90).length, 0);
  return `<p>Vitesse seconde par seconde, du ${when(blocks[0].begin, tz)} au ${when(new Date((t1) * 60000), tz)} : maximum <strong>${max} km/h</strong>${over90 ? `, <span class="neg">${hm(Math.round(over90 / 60))} au-dessus de 90 km/h</span>` : ''}.</p>
    <svg class="speed" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de vitesse">
      ${[30, 50, 70, 90, 110].map((v) => `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="${v === 90 ? 'lim' : 'grid'}"/><text x="4" y="${y(v) - 3}" class="ylab">${v}</text>`).join('')}
      ${paths.map((d) => `<path d="${d}" class="curve"/>`).join('')}
      ${ticks.join('')}
    </svg>${os}`;
}

function eventsHtml(st: State): string {
  const { vu, tz } = st;
  const rows = [
    ...vu.events.map((e) => ({ t: e.begin, html: `<td>${when(e.begin, tz)}</td><td>Événement</td><td>${SERIOUS_EVENTS.has(e.type) ? '<strong>' : ''}${esc(eventLabel(e.type))}${SERIOUS_EVENTS.has(e.type) ? '</strong>' : ''}${e.end ? `<br><small>jusqu’au ${when(e.end, tz)}</small>` : ''}</td><td class="mono">${esc(e.card.number)}</td>` })),
    ...vu.faults.map((e) => ({ t: e.begin, html: `<td>${when(e.begin, tz)}</td><td>Défaut</td><td>${esc(eventLabel(e.type))}</td><td class="mono">${esc(e.card.number)}</td>` })),
    ...vu.timeAdjustments.map((a) => ({ t: a.newTime, html: `<td>${when(a.newTime, tz)}</td><td>Réglage d’heure</td><td>de ${when(a.oldTime, tz)} à ${when(a.newTime, tz)}<br><small>${esc(a.workshop)}</small></td><td class="mono">${esc(a.card.number)}</td>` })),
    ...vu.controls.map((c) => ({ t: c.time, html: `<td>${when(c.time, tz)}</td><td>Contrôle</td><td>${esc(controlLabel(c.type))}${c.begin ? `<br><small>période : ${when(c.begin, tz)} → ${when(c.end, tz)}</small>` : ''}</td><td class="mono">${esc(c.card.number)}</td>` })),
    ...vu.downloads.map((d) => ({ t: d.time, html: `<td>${when(d.time, tz)}</td><td>Téléchargement</td><td>${esc(d.company)}</td><td class="mono">${esc(d.card.number)}</td>` })),
    ...vu.locks.map((l) => ({ t: l.lockIn, html: `<td>${when(l.lockIn, tz)}</td><td>Verrou</td><td>${esc(l.company)}${l.lockOut ? ` (retiré le ${when(l.lockOut, tz)})` : ' <strong>(actif)</strong>'}</td><td class="mono">${esc(l.card.number)}</td>` })),
  ].sort((a, b) => +(b.t ?? 0) - +(a.t ?? 0));
  if (!rows.length) return '<p>Aucun événement, défaut, contrôle ni téléchargement enregistré.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Nature</th><th>Détail</th><th>Carte</th></tr></thead><tbody>${rows.map((r) => `<tr>${r.html}</tr>`).join('')}</tbody></table></div>`;
}

function technicalHtml(st: State): string {
  const { vu, tz } = st;
  const id = vu.identification;
  const cal = [...vu.calibrations].sort((a, b) => +(b.newTime ?? 0) - +(a.newTime ?? 0));
  return `<dl class="acct-kv card" style="margin-bottom:1rem">
      <div><dt>Fabricant</dt><dd>${esc(id?.manufacturer || '—')}</dd></div>
      <div><dt>N° de série de l’appareil</dt><dd class="mono">${id?.serial ?? '—'}</dd></div>
      <div><dt>Logiciel</dt><dd class="mono">${esc(id?.software || '—')}</dd></div>
      <div><dt>Homologation</dt><dd class="mono">${esc(id?.approval || '—')}</dd></div>
      <div><dt>Capteur de mouvement</dt><dd class="mono">${vu.sensor ? `${vu.sensor.serial} (appairé le ${when(vu.sensor.paired, tz)})` : '—'}</dd></div>
    </dl>
    ${cal.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Objet</th><th>Atelier</th><th>Immatriculation</th><th>Pneus</th><th class="num">Vitesse autorisée</th><th class="num">k</th><th>Prochaine inspection</th></tr></thead><tbody>${cal.map((c) => `<tr>
      <td>${when(c.newTime, tz)}</td><td>${esc(CALIBRATION_PURPOSES[c.purpose] ?? String(c.purpose))}</td><td>${esc(c.workshop)}</td><td class="mono">${esc(c.plate)}</td><td>${esc(c.tyre)}</td><td class="num">${c.authorisedSpeed} km/h</td><td class="num">${c.k}</td><td>${when(c.next, tz)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Aucun étalonnage lisible dans ce fichier.</p>'}`;
}

function render(st: State): string {
  const { vu, tz } = st;
  const checks = vuChecks(vu);
  const inf = checks.filter((c) => c.level === 'infraction').length;
  const noCard = drivingWithoutCard(vu).reduce((t, s) => t + s.end - s.start, 0);
  const sessions = vu.days.flatMap((d) => d.sessions);
  const drivers = new Set(sessions.map((s) => s.card.number || s.surname)).size;
  const distance = vuDistance(vu);
  const li = (c: (typeof checks)[number]) => `<li class="${c.level === 'infraction' ? 'error' : c.level}"><span class="ic">${c.level === 'infraction' ? '✕' : c.level === 'warning' ? '!' : 'i'}</span><div>${esc(c.message)}</div><span></span></li>`;
  const tabs: [string, string, string][] = [
    ['points', `Points d’attention (${checks.length})`, `<ul class="checks">${checks.map(li).join('')}</ul><p class="hint">Lecture indicative : elle ne remplace pas un logiciel d’analyse agréé. La conduite sans carte peut être justifiée (déplacement en atelier, manœuvre, saisie manuelle).</p>`],
    ['jours', `Jour par jour (${vu.days.length})`, daysHtml(st)],
    ['conducteurs', `Conducteurs (${drivers})`, driversHtml(st)],
    ['vitesse', 'Vitesse', speedHtml(st)],
    ['evenements', `Événements (${vu.events.length + vu.faults.length})`, eventsHtml(st)],
    ['technique', 'Technique', technicalHtml(st)],
  ];
  return `<div class="banner ${inf ? 'err' : 'ok'}"><div><strong>Véhicule ${esc(nationSign(vu.nation))} ${esc(vu.plate || '—')}</strong>
      <p>VIN <span class="mono">${esc(vu.vin || '—')}</span> · appareil ${vu.generation === 2 ? (vu.version2 ? 'intelligent V2' : 'intelligent V1') : 'de 1re génération'}${vu.nation ? ` · immatriculé en ${esc(nationName(vu.nation))}` : ''}</p></div></div>
    <div class="stats">
      <div class="stat"><span class="stat-label">Période téléchargeable</span><strong>${vu.periodStart ? `${frDay(vu.periodStart.toISOString().slice(0, 10))} → ${frDay(vu.periodEnd!.toISOString().slice(0, 10))}` : '—'}</strong><span class="stat-sub">${vu.days.length} jour(s) dans ce fichier</span></div>
      <div class="stat"><span class="stat-label">Conducteurs</span><strong>${drivers}</strong><span class="stat-sub">${distance ? km(distance) + ' parcourus' : ''}</span></div>
      <div class="stat"><span class="stat-label">Conduite sans carte</span><strong class="${noCard ? 'neg' : 'pos'}">${hm(noCard)}</strong><span class="stat-sub">fente conducteur</span></div>
      <div class="stat"><span class="stat-label">Cartes à l’instant du téléchargement</span><strong style="font-size:0.95rem">${esc(SLOT_STATUS[vu.slots?.driver ?? 0] ?? '—')}</strong><span class="stat-sub">2e fente : ${esc(SLOT_STATUS[vu.slots?.codriver ?? 0] ?? '—')}</span></div>
    </div>
    ${vu.warnings.length ? `<div class="notice">${vu.warnings.map(esc).join('<br>')}</div>` : ''}
    <div class="export-bar">
      <span class="export-title">Exporter :</span><button type="button" class="btn" data-xlsx>Excel (.xlsx)</button>
      <label class="tz">Heures affichées <select data-tz><option value="Europe/Paris" ${tz !== 'UTC' ? 'selected' : ''}>heure de Paris</option><option value="UTC" ${tz === 'UTC' ? 'selected' : ''}>UTC (heure de l’appareil)</option></select></label>
    </div>
    ${thanksCard('analyse')}
    <div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${st.tab === id}">${label}</button>`).join('')}</div>
    ${tabs.map(([id, , html]) => `<div class="panel" data-panel="${id}" ${st.tab === id ? '' : 'hidden'}>${html}</div>`).join('')}
    <div class="btn-row" style="margin-top:1.2rem"><button type="button" class="btn ghost" data-reset>Lire un autre fichier</button><span class="hint">Fichier : ${esc(st.fileName)} · ${vu.transfers} bloc(s) de données (signatures non vérifiées) · cartes : ${[...new Set(sessions.map((s) => CARD_TYPES[s.card.type]).filter(Boolean))].join(', ') || '—'}</span></div>`;
}

export function mountVu(root: HTMLElement) {
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
      st = { ...st!, tz };
      paint();
    });
    out.querySelector('[data-xlsx]')!.addEventListener('click', async () => {
      const { vuXlsx } = await import('../lib/tacho/vu-export');
      download(vuXlsx(st!.vu, st!.tz), `vehicule-${(st!.vu.plate || 'vu').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.xlsx`, XLSX_TYPE);
    });
    out.querySelector('[data-reset]')!.addEventListener('click', () => {
      out.hidden = true;
      drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const show = (bytes: Uint8Array, fileName: string) => {
    out.hidden = false;
    out.innerHTML = waitCard('Lecture du fichier du véhicule…');
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      try {
        if (bytes[0] !== 0x76 && bytes.length > 5 && bytes[0] === 0x00 && (bytes[1] === 0x02 || bytes[1] === 0x05)) {
          out.innerHTML = `<div class="banner warn"><div><strong>C’est un fichier de carte conducteur</strong><p>Ce fichier vient d’une carte, pas de la mémoire d’un véhicule. <a href="${import.meta.env.BASE_URL}">Ouvrez-le avec le lecteur de cartes</a>.</p></div></div>`;
          return;
        }
        st = { vu: readVu(bytes), tz, fileName, tab: 'points' };
        paint();
      } catch (e) {
        out.innerHTML = `<div class="banner err"><div><strong>Lecture impossible</strong><p>${esc(e instanceof Error ? e.message : e)}</p></div></div>`;
      }
    }, 20);
  };

  bindDrop(drop, root.querySelector('[data-file]')!, async (file) => show(new Uint8Array(await file.arrayBuffer()), file.name));
  root.querySelector('[data-sample]')!.addEventListener('click', async () => {
    const { sampleVu } = await import('../lib/tacho/vu-sample');
    show(sampleVu(), 'vehicule-fictif-exemple.ddd');
  });
}
