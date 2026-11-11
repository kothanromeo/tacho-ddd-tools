import { remaining } from '../lib/tacho/remaining';
import { hm } from '../lib/tacho/timeline';
import { esc } from './ui';

/** « 3:45 », « 3h45 », « 3 h 45 », « 3,75 », « 45 min » → minutes. */
export function parseDuration(raw: string): number | undefined {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return 0;
  let m = s.match(/^(\d{1,3})(?:[:h](\d{1,2})?)?(?:min)?$/);
  if (m && (s.includes(':') || s.includes('h'))) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = s.match(/^(\d{1,3})min$/);
  if (m) return Number(m[1]);
  m = s.match(/^(\d{1,3})(?:[.,](\d+))?$/);
  if (m) return Math.round(Number(`${m[1]}.${m[2] ?? 0}`) * 60);
  return undefined;
}

export function mountCalc(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('[data-calc-form]')!;
  const out = root.querySelector<HTMLElement>('[data-calc-out]')!;
  const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;

  const update = () => {
    const fields = ['sinceBreak', 'today', 'week', 'lastWeek'] as const;
    const parsed = Object.fromEntries(fields.map((f) => [f, parseDuration(val(f))])) as Record<(typeof fields)[number], number | undefined>;
    const bad = fields.filter((f) => parsed[f] === undefined);
    form.querySelectorAll<HTMLInputElement>('input').forEach((i) => i.classList.toggle('invalid', bad.includes(i.name as (typeof fields)[number])));
    if (bad.length) {
      out.innerHTML = '<p class="neg">Durée illisible : utilisez la forme 3:45 ou 3h45.</p>';
      return;
    }
    let sinceRest: number | undefined;
    const start = val('start');
    if (start) {
      const now = new Date();
      const [h, m] = start.split(':').map(Number);
      sinceRest = (now.getHours() * 60 + now.getMinutes() - (h * 60 + m) + 1440) % 1440;
    }
    const r = remaining({
      sinceBreak: parsed.sinceBreak!, today: parsed.today!, week: parsed.week!, lastWeek: parsed.lastWeek!,
      split15: (form.elements.namedItem('split15') as HTMLInputElement).checked,
      extensionsUsed: Number(val('extensionsUsed')), reducedUsed: Number(val('reducedUsed')), sinceRest,
    });
    const max = Math.max(...r.limits.map((l) => l.remaining), 1);
    out.innerHTML = `<p class="calc-big">${r.next.remaining > 0
      ? `Vous pouvez encore conduire <strong>${hm(r.next.remaining)}</strong>`
      : '<strong class="neg">Arrêtez-vous : une limite est atteinte</strong>'}</p>
      <p class="calc-sub">Limite la plus proche : ${esc(r.next.label.toLowerCase())}. ${r.todayMax > r.next.remaining ? `Après la pause, il vous restera au plus ${hm(r.todayMax - r.next.remaining)} de conduite aujourd’hui.` : ''}</p>
      <ul class="limits">${r.limits.map((l) => `<li class="${l === r.next ? 'next' : ''}">
        <div class="lim-head"><span>${esc(l.label)}</span><strong>${hm(l.remaining)}</strong></div>
        <div class="gauge"><span style="width:${((l.remaining / max) * 100).toFixed(1)}%" class="${l.remaining === 0 ? 'over' : ''}"></span></div>
        <p class="hint">${esc(l.detail)}</p></li>`).join('')}</ul>
      <p class="hint">Calcul indicatif selon le règlement (CE) 561/2006. Votre chronotachygraphe fait foi.</p>`;
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();
}
