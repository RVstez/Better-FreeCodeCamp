import { createEditorShell } from './editor-shell.js';
// Curriculum AST -> DOM. Only createElement/textContent: no innerHTML, so curriculum text can never inject markup.
const el = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) n === 'class' ? (e.className = v) : e.setAttribute(n, v); e.append(...k.flat().filter((x) => x != null)); return e; };
export function inline(nodes = []) {
  return nodes.map((n) => {
    if (typeof n === 'string') return n;
    switch (n.t) {
      case 'code': return el('code', {}, n.v);
      case 'strong': return el('strong', {}, inline(n.c));
      case 'em': return el('em', {}, inline(n.c));
      case 'el': return el(n.tag, {}, inline(n.c));
      case 'a': return el('a', { href: n.href, target: '_blank', rel: 'noopener noreferrer' }, inline(n.c));
      case 'br': return el('br');
      case 'img': { const i = el('img', { src: n.src, alt: n.alt, loading: 'lazy' }); i.onerror = () => i.replaceWith(el('span', { class: 'img-off' }, n.alt || 'image unavailable offline')); return i; }
      default: return '';
    }
  });
}
export function blocks(nodes = []) {
  const f = document.createDocumentFragment();
  for (const b of nodes) {
    switch (b.t) {
      case 'p': f.append(el('p', {}, inline(b.c))); break;
      case 'h': f.append(el('h' + Math.min(6, b.l + 1), {}, inline(b.c))); break;
      case 'ul': case 'ol': f.append(el(b.t, b.start ? { start: b.start } : {}, b.items.map((it) => { const li = el('li'); li.append(blocks(it)); return li; }))); break;
      case 'code': f.append(codeBlock(b.lang, b.text)); break;
      case 'editor': f.append(editor(b.files)); break;
      case 'table': f.append(el('div', { class: 'scroll' }, el('table', {}, b.caption ? el('caption', {}, inline(b.caption)) : null, b.rows.map((r) => el('tr', {}, r.cells.map((c) => el(c.th ? 'th' : 'td', c.scope ? { scope: c.scope } : {}, inline(c.c)))))))); break;
      case 'hr': f.append(el('hr')); break;
    }
  }
  return f;
}
export function codeBlock(lang, text, editable) {
  const lines = text.split('\n');
  return el('pre', { class: 'code-block' + (lang ? ' has-lang' : ''), ...(lang ? { 'data-lang': lang } : {}) },
    el('code', {}, lines.map((l, i) => el('span', { class: editable && i >= editable[0] && i < editable[1] ? 'ln edit' : 'ln' }, l + '\n'))));
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
