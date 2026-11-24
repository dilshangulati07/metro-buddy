// report.js - "Report a problem": a small form that sends what is wrong, plus the route or
// station and the fares the site showed, to /api/report (functions/api/report.js).
import { t, getLang } from './i18n.js';
import { track } from './track.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KINDS = ['fare', 'platform', 'exit', 'route', 'station', 'other'];

/**
 * @param {{ about: string, context: object, kind?: string, onDone?: (msg) => void }} opts
 *   about   what the report is about, shown at the top ("Mo Chit → Asok")
 *   context { from, to, station, passenger, shown: [{ system, from, to, adult, status }] }
 */
export function openReport({ about, context, kind = 'fare', onDone }) {
  let dialog = document.getElementById('report-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'report-dialog';
    dialog.className = 'report';
    dialog.setAttribute('aria-labelledby', 'report-title');
    document.body.append(dialog);
  }
  dialog.innerHTML = `
    <form class="report__form" method="dialog" novalidate>
      <div class="report__head">
        <h2 id="report-title">${esc(t('reportTitle'))}</h2>
        <button type="button" class="iconbtn" data-close aria-label="${esc(t('cancel'))}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      </div>
      <p class="muted report__lead">${esc(t('reportLead'))}</p>
      <p class="report__about">${esc(t('reportAbout', about))}</p>
      <fieldset class="report__kinds"><legend>${esc(t('reportWhat'))}</legend>
        ${KINDS.map((k) => `<label><input type="radio" name="kind" value="${k}" ${k === kind ? 'checked' : ''}><span>${esc(t(`kind_${k}`))}</span></label>`).join('')}
      </fieldset>
      <label class="report__field" data-for="fare"><span>${esc(t('reportPaid'))}</span><input name="paid" type="number" inputmode="numeric" min="1" max="499" step="1"></label>
      <label class="report__field"><span>${esc(t('reportDetails'))}</span><textarea name="details" rows="4" maxlength="1000" required placeholder="${esc(t('reportDetailsPh'))}"></textarea></label>
      <label class="report__field"><span>${esc(t('reportEmail'))}</span><input name="email" type="email" maxlength="120" autocomplete="email"></label>
      <label class="report__hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off"></label>
      <p class="report__msg" role="status" aria-live="polite"></p>
      <div class="report__actions">
        <button type="button" class="btn" data-close>${esc(t('cancel'))}</button>
        <button type="submit" class="btn btn--primary">${esc(t('reportSend'))}</button>
      </div>
    </form>`;

  const form = dialog.querySelector('form');
  const fareField = form.querySelector('[data-for="fare"]');
  const syncKind = () => { fareField.hidden = form.elements.kind.value !== 'fare'; };
  form.addEventListener('change', syncKind);
  syncKind();
  dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = form.querySelector('.report__msg');
    const f = new FormData(form);
    const details = String(f.get('details') || '').trim();
    if (details.length < 5) {
      msg.textContent = t('reportTooShort');
      form.elements.details.focus();
      return;
    }
    const send = form.querySelector('[type=submit]');
    send.disabled = true;
    send.textContent = t('reportSending');
    msg.textContent = '';
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: f.get('kind'),
          details,
          paid: f.get('kind') === 'fare' && f.get('paid') ? Number(f.get('paid')) : null,
          email: f.get('email'),
          website: f.get('website'),
          context: { ...context, lang: getLang() },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) throw new Error(body.message || t('reportFailed'));
      track('report', f.get('kind'));
      dialog.close();
      onDone?.(t('reportThanks'));
    } catch (err) {
      msg.textContent = err.message || t('reportFailed');
      send.disabled = false;
      send.textContent = t('reportSend');
    }
  });
  dialog.showModal();
  form.querySelector('input[name=kind]:checked').focus();
}
