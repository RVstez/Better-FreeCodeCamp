// Live preview: an iframe built from srcdoc. It fills its panel and scrolls inside it (no auto-sizing: measuring the
// content height from inside a frame whose height we then change feeds back on itself for any page that uses
// viewport-relative heights, which made the frame grow on its own). Sandboxed without allow-same-origin, so nothing
// running in it can reach this page or its storage; scripts are only allowed when the example contains JavaScript.
import { el } from './dom.js';
const LOCAL_CSS = /<link\b[^>]*\bhref\s*=\s*["'](?!https?:|\/\/)[^"']+["'][^>]*>/gi;
const LOCAL_JS = /<script\b[^>]*\bsrc\s*=\s*["'](?!https?:|\/\/)[^"']+["'][^>]*>\s*<\/script>/gi;
export function previewDoc(files) {
  const by = (l) => files.find((f) => f.lang === l)?.contents ?? files.find((f) => f.lang === l)?.text ?? '';
  const css = by('css'), js = by('js') || by('javascript');
  let html = by('html');
  if (css && LOCAL_CSS.test((LOCAL_CSS.lastIndex = 0, html))) html = html.replace(LOCAL_CSS, (m) => (/stylesheet/i.test(m) ? `<style>${css}</style>` : m));
  else if (css) html += `<style>${css}</style>`;
  const safe = js.replace(/<\/script/gi, '<\\/script');
  if (js) html = LOCAL_JS.test((LOCAL_JS.lastIndex = 0, html)) ? html.replace(LOCAL_JS, () => `<script>${safe}</script>`) : html + `<script>${safe}</script>`;
  return { doc: html, scripts: !!js };
}
export function setPreview(frame, files) {
  const { doc, scripts } = previewDoc(files);
  frame.setAttribute('sandbox', scripts ? 'allow-scripts' : '');
  frame.srcdoc = `<!doctype html><meta charset="utf-8"><base target="_blank"><style>body{font-family:system-ui,sans-serif;margin:8px}</style>${doc}`;
}
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// The preview panel, with width presets: this is a *responsive* design course, so being able to see a page at phone and
// tablet width (and read the current width) is part of what the learner is practising.
export function createPreviewPanel() {
  const frame = el('iframe', { class: 'preview-frame', title: 'Preview of your code' });
  const readout = el('span', { class: 'pv-readout' });
  const measure = () => { readout.textContent = Math.round(frame.getBoundingClientRect().width) + 'px'; };
  const presets = [['Fit', '100%'], ['768', '768px'], ['375', '375px']].map(([label, w], i) => {
    const b = el('button', { class: 'tool pv-preset' + (i ? '' : ' active'), type: 'button', title: i ? `Preview at ${w} wide` : 'Fill the panel', onclick: () => {
      frame.style.setProperty('--pw', w); presets.forEach((x) => x.classList.toggle('active', x === b)); requestAnimationFrame(measure); } }, label);
    return b;
  });
  if (window.ResizeObserver) new ResizeObserver(measure).observe(frame);
  const panel = el('div', { class: 'panel preview-panel' }, el('div', { class: 'panel-head' }, el('span', { class: 'ph-label' }, 'Preview'), el('span', { class: 'pv-tools' }, presets, readout)),
    el('div', { class: 'panel-body preview-body' }, frame));
  return { panel, frame };
}
