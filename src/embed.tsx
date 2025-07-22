/* ------------------------------------------------------------------
 *  Inietta il widget e converte i data-* in prop
 * ------------------------------------------------------------------ */
import ReactDOM from 'react-dom/client';
import ChatWidget, { type ChatWidgetProps } from './ChatWidget';
import { setApiBase } from './api/api';

/* ------------------------------------------------------------------
 *  1 · Tipi  
 *     - ChatWidgetProps → quelle che il componente sa gestire
 *     - Embed-only      → api / colori / badge stringa │ array
 * ------------------------------------------------------------------ */
interface EmbedOpts extends Omit<ChatWidgetProps, 'badgeMsgs'> {
  /* extra “embed” */
  api?: string;
  accentDark?: string;
  bg?: string;
  bgDark?: string;
  text?: string;

  /* badge (può arrivare come stringa "a|b|c" oppure array)        */
  badgeMsgs?: string | string[];
}

/* ------------------------------------------------------------------
 *  2 · CSS custom via variabili
 * ------------------------------------------------------------------ */
function applyCSSVars(o: EmbedOpts) {
  const r = document.documentElement.style;
  if (o.accent)     r.setProperty('--mlr-accent',       o.accent);
  if (o.accentDark) r.setProperty('--mlr-accent-dark',  o.accentDark);
  if (o.bg)         r.setProperty('--mlr-bg',           o.bg);
  if (o.bgDark)     r.setProperty('--mlr-bg-dark',      o.bgDark);
  if (o.text)       r.setProperty('--mlr-text',         o.text);
}

/* ------------------------------------------------------------------
 *  3 · Assicuriamo il meta viewport (anti-zoom iOS)                 */
(() => {
  if (!document.querySelector('meta[name="viewport"]')) {
    const m = document.createElement('meta');
    m.name = 'viewport';
    m.content = 'width=device-width,initial-scale=1,maximum-scale=1';
    document.head.appendChild(m);
  }
})();

/* ------------------------------------------------------------------
 *  4 · Mount reale del widget                                       */
function mount(opts: EmbedOpts) {
  /* 4.1 – API base */
  if (opts.api) setApiBase(opts.api);

  /* 4.2 – CSS vars */
  applyCSSVars(opts);

  /* 4.3 – Host invisibile */
  const host = document.createElement('div');
  document.body.appendChild(host);

  /* 4.4 – Converte eventuale stringa “a|b|c” in array */
  const badgeArr = typeof opts.badgeMsgs === 'string'
    ? opts.badgeMsgs.split('|').map(t => t.trim()).filter(Boolean)
    : opts.badgeMsgs;

  /* 4.5 – Prop “embed-only” da scartare prima del render */
  const {
    api, accentDark, bg, bgDark, text,        // embed only
    badgeMsgs,                                // sostituito con badgeArr
    ...widgetProps
  } = opts;

  ReactDOM
    .createRoot(host)
    .render(<ChatWidget {...widgetProps} badgeMsgs={badgeArr} />);
}

/* ------------------------------------------------------------------
 *  5 · API globale window.ChatWidget.init                            */
declare global {
  interface Window { ChatWidget: { init(o: EmbedOpts): void } }
}
window.ChatWidget = { init: mount };

/* ------------------------------------------------------------------
 *  6 · Auto-mount se <script> ha gli attributi data-*                */
const s = document.currentScript as HTMLScriptElement | null;
if (s?.dataset.slug) {
  mount({
    /* obbligatorie */
    slug   : s.dataset.slug!,
    title  : s.dataset.title,

    /* opzionali */
    api        : s.dataset.api,
    accent     : s.dataset.accent,
    accentDark : s.dataset.accentDark,
    bg         : s.dataset.bg,
    bgDark     : s.dataset.bgDark,
    text       : s.dataset.text,
    logoUrl    : s.dataset.logo,
    startText  : s.dataset.startText,
    floating   : s.dataset.floating === 'true',

    /* badge: CSV “a|b|c” */
    badgeMsgs  : s.dataset.badges
  });
}