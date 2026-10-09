import { createEditorShell } from './editor-shell.js';
import { toast } from './dom.js';
import { icon } from './ui.js';
// Curriculum AST -> DOM. Only createElement/textContent: no innerHTML, so curriculum text can never inject markup.
const el = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) n === 'class' ? (e.className = v) : e.setAttribute(n, v); e.append(...k.flat().filter((x) => x != null)); return e; };
// Read reference values without interpreting curriculum examples as live HTML.
function references(text) {
  const values = [];
  const add = (value) => { if (value && !values.includes(value)) values.push(value); };
  for (const m of text.matchAll(/\b(?:src|href|action|poster|cite|formaction|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) add(m[1] ?? m[2] ?? m[3]);
  for (const m of text.matchAll(/\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) add(m[1] ?? m[2] ?? m[3]);
  const value = text.trim().replace(/^(["'])(.*)\1$/, '$2');
  if (!/[<>]/.test(value) && (/^(?:(?:(?:https?|ftp|file):\/\/|mailto:|tel:|\/\/|\.{1,2}\/|\/)\S+|#[\w-]+)$/i.test(value) || /^[\w@-][\w./@-]*\.(?:html?|css|m?js|json|svg|png|jpe?g|gif|webp|ico|avif|mp[34]|wav|ogg|webm|woff2?|ttf|pdf)(?:[?#]\S*)?$/i.test(value))) add(value);
  return values;
}

async function writeClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* Older browsers and non-secure local addresses use the fallback. */ }
  const active = document.activeElement, selection = getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = el('textarea', { class: 'copy-fallback', 'aria-hidden': 'true', tabindex: '-1' });
  field.value = text; document.body.append(field); field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { /* Report failure instead of claiming it was copied. */ }
  finally {
    field.remove(); active?.focus({ preventScroll: true });
    if (selection) { selection.removeAllRanges(); ranges.forEach(range => selection.addRange(range)); }
  }
  return copied;
}

function copyButton(text, kind, label = null) {
  const title = kind === 'code' ? 'Copy code' : `Copy link: ${text}`;
  const button = el('button', { type: 'button', class: 'lesson-copy' + (label ? ' code-link-copy' : ''), 'data-copy-kind': kind, 'aria-label': title, title: `${title} (Ctrl+Shift+Y)`, 'aria-keyshortcuts': 'Control+Shift+Y Meta+Shift+Y' },
    label ? el('span', { class: 'code-link-value' }, label) : null, icon('copy'));
  let timer, busy = false;
  button.lessonCopy = { text, copy: async () => {
    if (busy) return; busy = true;
    try {
      if (!await writeClipboard(text)) { toast('Could not copy. Select the link or code and copy it manually.'); return; }
      button.classList.add('copied'); button.querySelector('svg').replaceWith(icon('check'));
      toast(kind === 'code' ? 'Code copied' : 'Link copied');
      clearTimeout(timer); timer = setTimeout(() => { button.classList.remove('copied'); button.querySelector('svg').replaceWith(icon('copy')); }, 1600);
    } finally { busy = false; }
  } };
  button.addEventListener('click', () => button.lessonCopy.copy());
  return button;
}

// Focus/selection chooses an explicit item. In workshop instructions the last inline reference is
// normally the requested value, after any explanatory examples. Lectures use the nearest visible item.
export function copyLessonReference() {
  const targets = [...document.querySelectorAll('#view .lesson-copy')].filter(b => b.getClientRects().length);
  const focused = targets.find(b => b === document.activeElement);
  const selection = getSelection(), node = selection?.anchorNode;
  const selectedSource = selection?.toString() ? (node?.nodeType === 1 ? node : node?.parentElement)?.closest('.copy-source') : null;
  const selected = selectedSource && targets.find(b => b.lessonCopy.text === selection.toString()) || selectedSource?.querySelector('.lesson-copy');
  const instructions = targets.filter(b => b.closest('.lesson-brief .prose'));
  const inlineLinks = instructions.filter(b => b.hasAttribute('data-copy-inline'));
  const links = instructions.filter(b => b.dataset.copyKind === 'link');
  const visible = targets.filter(b => { const r = b.getBoundingClientRect(); return r.bottom > 76 && r.top < innerHeight; });
  const nearby = visible.length ? visible : targets;
  const distance = b => { const r = b.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - innerHeight / 2); };
  const target = focused ?? selected ?? inlineLinks.at(-1) ?? links.at(-1) ?? instructions[0] ?? nearby.sort((a, b) => distance(a) - distance(b))[0];
  if (target) return target.lessonCopy.copy();
  toast('No lesson link or code block to copy.');
}

export function inline(nodes = [], copyable = true) {
  return nodes.map((n) => {
    if (typeof n === 'string') return n;
    switch (n.t) {
      case 'code': {
        const code = el('code', {}, n.v), values = copyable ? references(n.v) : [];
        return values.length ? el('span', { class: 'copy-reference copy-source' }, code, values.map(value => { const button = copyButton(value, 'link'); button.setAttribute('data-copy-inline', ''); return button; })) : code;
      }
      case 'strong': return el('strong', {}, inline(n.c, copyable));
      case 'em': return el('em', {}, inline(n.c, copyable));
      case 'el': return el(n.tag, {}, inline(n.c, copyable));
      case 'a': {
        const link = el('a', { href: n.href, target: '_blank', rel: 'noopener noreferrer' }, inline(n.c, false));
        if (!copyable || !n.href) return link;
        const button = copyButton(n.href, 'link'); button.setAttribute('data-copy-inline', '');
        return el('span', { class: 'copy-reference copy-source' }, link, button);
      }
      case 'br': return el('br');
      case 'img': { const i = el('img', { src: n.src, alt: n.alt, loading: 'lazy' }); i.onerror = () => i.replaceWith(el('span', { class: 'img-off' }, n.alt || 'image unavailable offline')); return i; }
      default: return '';
    }
  });
}
export function blocks(nodes = [], copyable = true) {
  const f = document.createDocumentFragment();
  for (const b of nodes) {
    switch (b.t) {
      case 'p': f.append(el('p', {}, inline(b.c, copyable))); break;
      case 'h': f.append(el('h' + Math.min(6, b.l + 1), {}, inline(b.c, copyable))); break;
      case 'ul': case 'ol': f.append(el(b.t, b.start ? { start: b.start } : {}, b.items.map((it) => { const li = el('li'); li.append(blocks(it, copyable)); return li; }))); break;
      case 'code': f.append(codeBlock(b.lang, b.text, undefined, copyable)); break;
      case 'editor': f.append(editor(b.files)); break;
      case 'table': f.append(el('div', { class: 'scroll' }, el('table', {}, b.caption ? el('caption', {}, inline(b.caption, copyable)) : null, b.rows.map((r) => el('tr', {}, r.cells.map((c) => el(c.th ? 'th' : 'td', c.scope ? { scope: c.scope } : {}, inline(c.c, copyable)))))))); break;
      case 'hr': f.append(el('hr')); break;
    }
  }
  return f;
}
export function codeBlock(lang, text, editable, copyable = true) {
  const lines = text.split('\n');
  const pre = el('pre', { class: 'code-block' + (!copyable && lang ? ' has-lang' : ''), ...(lang ? { 'data-lang': lang } : {}) },
    el('code', {}, lines.map((l, i) => el('span', { class: editable && i >= editable[0] && i < editable[1] ? 'ln edit' : 'ln' }, l + '\n'))));
  if (!copyable) return pre;
  const values = references(text);
  return el('div', { class: 'code-sample copy-source' },
    el('div', { class: 'code-copy-bar' }, el('span', { class: 'code-language' }, lang || 'Code'), copyButton(text, 'code')), pre,
    values.length ? el('div', { class: 'code-links' }, values.map(value => copyButton(value, 'link', value))) : null);
}

// Lightweight interactive example: editable panels plus a live preview (no IDE).
export function editor(files) {
  return createEditorShell({ files: files.map((f) => ({ lang: f.lang })), values: files.map((f) => f.text), label: files[0].lang }).root;
}

// True when a block of prose is exactly one line of code with nothing else around it (a single fenced
// block, or a paragraph that is entirely one inline code span) — the freeCodeCamp convention for an
// answer choice that IS code, rendered as a bordered monospace block instead of run into a sentence.
export function asChoiceCode(nodes = []) {
  if (nodes.length === 1 && nodes[0].t === 'code') return nodes[0].text;
  if (nodes.length === 1 && nodes[0].t === 'p' && nodes[0].c.length === 1 && nodes[0].c[0]?.t === 'code') return nodes[0].c[0].v;
  return null;
}

