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
interface EmbedOpts extends Omit<ChatWidgetProps, 'badgeMsgs'>  {
  api?: string;
  accentDark?: string;
  bg?: string;
  bgDark?: string;
  text?: string;
  // --- NUOVI ATTRIBUTI DI COLORE ---
  chatBg?: string;
  userBubbleBg?: string;
  userBubbleText?: string;
  assistantBubbleBg?: string;
  assistantBubbleText?: string;
  badgeMsgs?: string | string[];
}

/* ------------------------------------------------------------------
 *  2 · CSS custom via variabili
 * ------------------------------------------------------------------ */
function applyCSSVars(o: EmbedOpts) {
  const r = document.documentElement.style;
  if (o.accent)     r.setProperty('--mlr-accent', o.accent);
  if (o.accentDark) r.setProperty('--mlr-accent-dark', o.accentDark);
  if (o.bg)         r.setProperty('--mlr-bg', o.bg);
  if (o.bgDark)     r.setProperty('--mlr-bg-dark', o.bgDark);
  if (o.text)       r.setProperty('--mlr-text', o.text);
  // --- NUOVE VARIABILI CSS ---
  if (o.chatBg)             r.setProperty('--mlr-chat-bg', o.chatBg);
  if (o.userBubbleBg)       r.setProperty('--mlr-user-bubble-bg', o.userBubbleBg);
  if (o.userBubbleText)     r.setProperty('--mlr-user-bubble-text', o.userBubbleText);
  if (o.assistantBubbleBg)  r.setProperty('--mlr-assistant-bubble-bg', o.assistantBubbleBg);
  if (o.assistantBubbleText)r.setProperty('--mlr-assistant-bubble-text', o.assistantBubbleText);
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
  if (opts.api) setApiBase(opts.api);
  applyCSSVars(opts);
  const host = document.createElement('div');
  document.body.appendChild(host);

  const badgeArr = typeof opts.badgeMsgs === 'string'
    ? opts.badgeMsgs.split('|').map(t => t.trim()).filter(Boolean)
    : opts.badgeMsgs;

  const {
    api, accentDark, bg, bgDark, text,
    chatBg, userBubbleBg, userBubbleText, assistantBubbleBg, assistantBubbleText, // Escludiamo le nuove prop
    badgeMsgs,
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
    slug   : s.dataset.slug!,
    title  : s.dataset.title,
    api        : s.dataset.api,
    accent     : s.dataset.accent,
    accentDark : s.dataset.accentDark,
    bg         : s.dataset.bg,
    bgDark     : s.dataset.bgDark,
    text       : s.dataset.text,
    logoUrl    : s.dataset.logo,
    startText  : s.dataset.startText,
    floating   : s.dataset.floating === 'true',
    badgeMsgs  : s.dataset.badges,
    // --- NUOVI DATA-* LETTI DALLO SCRIPT ---
    chatBg             : s.dataset.chatBg,
    userBubbleBg       : s.dataset.userBubbleBg,
    userBubbleText     : s.dataset.userBubbleText,
    assistantBubbleBg  : s.dataset.assistantBubbleBg,
    assistantBubbleText: s.dataset.assistantBubbleText,
  });

}