// The code editor as one component: Monaco (one instance per file), the live preview beside it, a small tool bar
// (font size, reset, copy, full screen), and a keyboard API used by the app-level shortcuts in app.js:
//   root.rvstez = { focus, blur, hasFocus, isFull, setFull, flush }
// Used by workshop/lab pages and by the interactive examples in lectures.
import { el, toast } from './dom.js';
import { createEditor } from './monaco-loader.js';
import { createPreviewPanel, setPreview, debounce } from './preview.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const safeGet = (ed, fallback) => { try { return ed ? ed.getValue() : fallback; } catch { return fallback; } }; // a disposed editor must not throw

// Monaco scrolls its own content, never the page, so a cursor could move out of the window (under the top bar, or below the fold)
// while the editor was only partly on screen. Keep the cursor visible in the page too.
const TOP = 76; // sticky top bar + breathing room
function keepCursorInView(ed) {
  const pos = ed.getPosition(), v = pos && ed.getScrolledVisiblePosition(pos); if (!v) return;
  const y = ed.getDomNode().getBoundingClientRect().top + v.top, h = v.height || 19, bottom = innerHeight - 24;
  if (y < TOP) scrollBy({ top: y - TOP, behavior: 'instant' }); else if (y + h > bottom) scrollBy({ top: y + h - bottom, behavior: 'instant' });
}

export function createEditorShell({ files, values, seedValues = values, label, onInput, onCheck }) {
  const store = window.rvstez?.store;
  let fontSize = store?.get().settings.editorFontSize ?? 13;
  const mounts = files.map(() => el('div', { class: 'monaco-mount' }));
  const pending = files.map((f, i) => createEditor(mounts[i], { lang: f.lang, value: values[i], fontSize }));
  let ready = [], active = 0;
  const getFiles = () => files.map((f, i) => ({ lang: f.lang, contents: safeGet(ready[i], values[i]) }));

  const preview = createPreviewPanel();
  const update = () => { if (root.isConnected) setPreview(preview.frame, getFiles()); };
  const later = debounce(update, 400);

  const show = (k) => { active = k; mounts.forEach((m, i) => { m.hidden = i !== k; tabs[i]?.classList.toggle('active', i === k); }); ready[k]?.layout(); };
  const tabs = files.map((f, i) => el('button', { class: 'file-tab', type: 'button', onclick: () => show(i) }, f.lang));
  const codeHead = files.length > 1 ? el('div', { class: 'file-tabs' }, tabs) : el('div', { class: 'panel-head' }, el('span', { class: 'ph-label' }, label ?? files[0].lang));
  const codePanel = el('div', { class: 'panel code-panel' }, codeHead, el('div', { class: 'panel-body monaco-body' }, mounts));

  const tool = (text, title, fn) => el('button', { class: 'tool', type: 'button', title, 'aria-label': title, onclick: fn }, text);
  const setView = (v) => { root.dataset.view = v; viewBtns.forEach((b) => b.classList.toggle('active', b.dataset.v === v)); if (v === 'code') ready[active]?.layout(); };
  const viewBtns = [['code', 'Code'], ['preview', 'Preview']].map(([v, t]) => el('button', { class: 'tool view-toggle' + (v === 'code' ? ' active' : ''), type: 'button', 'data-v': v, onclick: () => setView(v) }, t));
  const savedNote = el('span', { class: 'saved-note' });
  const barStatus = el('span', { class: 'bar-status', 'aria-hidden': 'true' });
  const fullBtn = tool('Full screen', 'Full screen (Ctrl+M)', () => setFull(!root.classList.contains('full')));

  const setFull = (on) => {
    root.classList.toggle('full', on); document.body.classList.toggle('editor-full', on); fullBtn.textContent = on ? 'Exit full screen' : 'Full screen';
    requestAnimationFrame(() => { ready.forEach((e) => e.layout()); if (on) ready[active]?.focus(); });
  };
  const setFont = (d) => { fontSize = clamp(fontSize + d, 10, 22); ready.forEach((e) => e.updateOptions({ fontSize })); store?.setSetting('editorFontSize', fontSize); toast(`Editor text ${fontSize}px`); };
  const reset = () => {
    ready.forEach((ed, i) => { const m = ed.getModel(); if (!m) return; ed.pushUndoStop(); ed.executeEdits('reset', [{ range: m.getFullModelRange(), text: seedValues[i] }]); ed.pushUndoStop(); });
    toast('Starting code restored — Ctrl+Z undoes it'); update();
  };
  const copy = async () => {
    const text = safeGet(ready[active], '');
    try { await navigator.clipboard.writeText(text); } catch { const t = el('textarea'); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch { /* nothing more to try */ } t.remove(); }
    toast('Copied');
  };
  const checkBtn = onCheck ? el('button', { class: 'btn sm bar-check', type: 'button', onclick: onCheck }, 'Check  ⌃⇧G') : null;

  const bar = el('div', { class: 'editor-bar' }, el('span', { class: 'editor-label' }, 'Workspace'), viewBtns, el('span', { class: 'bar-spacer' }), barStatus, savedNote,
    tool('A−', 'Smaller editor text', () => setFont(-1)), tool('A+', 'Larger editor text', () => setFont(1)),
    tool('Reset', 'Restore the starting code', reset), tool('Copy', 'Copy your code', copy), fullBtn, checkBtn);
  const root = el('div', { class: 'editor-shell', 'data-view': 'code' }, bar, el('div', { class: 'editor-grid' }, codePanel, preview.panel));

  // Escape leaves full screen unless Monaco used it first (closing its find/suggest widgets stops the event before it gets here).
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('full')) setFull(false); });

  // Like any scrolling box: ArrowUp at the very start / ArrowDown at the very end of the code keeps going and scrolls the page.
  root.addEventListener('keydown', (e) => {
    if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || root.classList.contains('full')) return;
    const ed = ready.find((x) => x.hasTextFocus()), m = ed?.getModel(), pos = ed?.getPosition(); if (!m || !pos) return;
    const atStart = pos.lineNumber === 1 && pos.column === 1, atEnd = pos.lineNumber === m.getLineCount() && pos.column === m.getLineMaxColumn(pos.lineNumber);
    if ((e.key === 'ArrowUp' && atStart) || (e.key === 'ArrowDown' && atEnd)) { e.preventDefault(); scrollBy({ top: e.key === 'ArrowUp' ? -90 : 90, behavior: 'instant' }); }
  }, true);

  root.rvstez = {
    focus() { ready[active]?.focus(); root.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, // focus first: focusing scrolls instantly and would cancel a smooth scroll started before it
    blur() { document.activeElement?.blur?.(); },
    hasFocus: () => root.contains(document.activeElement),
    isFull: () => root.classList.contains('full'),
    setFull, flush: () => onInput?.(getFiles(), true),
  };
  show(0);
  const whenReady = Promise.all(pending).then((list) => {
    ready = list;
    list.forEach((ed) => {
      ed.onDidChangeModelContent(() => { later(); onInput?.(getFiles(), false); });
      ed.onDidChangeCursorPosition(() => { if (ed.hasTextFocus() && !root.classList.contains('full')) keepCursorInView(ed); });
    });
    show(0); update(); return list;
  });
  return { root, getFiles, whenReady, setStatus: (t) => { barStatus.textContent = t; }, setSaved: (t) => { savedNote.textContent = t; } };
}
