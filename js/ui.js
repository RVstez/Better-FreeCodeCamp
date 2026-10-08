import { el, go } from './dom.js';

// Small local SVGs keep navigation crisp, lightweight, and available offline.
const paths = {
  home: ['M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z'],
  html: ['m8 7-5 5 5 5', 'm16 7 5 5-5 5', 'm14 4-4 16'],
  css: ['M4 4h16v16H4Z', 'M4 10h16', 'M10 10v10'],
  computers: ['M3 4h18v13H3Z', 'M8 21h8', 'M12 17v4'],
  workshops: ['m14 3 7 7-11 11H3v-7Z', 'm11 6 7 7'],
  labs: ['M9 3h6', 'M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3', 'M7 15h10'],
  projects: ['M4 7h16v14H4Z', 'M9 7V3h6v4', 'M4 12h16', 'M10 12v3h4v-3'],
  exam: ['M8 3h8l4 4v14H4V3Z', 'M16 3v5h4', 'm8 14 3 3 5-6'],
  arrow: ['M4 12h15', 'm13 6 6 6-6 6'],
  check: ['m5 12 4 4L19 6'],
  book: ['M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z', 'M12 5v15'],
  search: ['M17 17l4 4'],
};
export function icon(name, cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'ui-icon ' + cls })) svg.setAttribute(k, v);
  for (const d of paths[name] ?? paths.book) { const p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', d); svg.append(p); }
  return svg;
}

export function setupDiscovery({ idx, store }) {
  const searchBtn = document.getElementById('searchBtn');
  const records = idx.chapters.flatMap(ch => ch.modules.flatMap(m => m.blocks.map(b => ({
    b, ch, m, words: `${ch.title} ${m.title} ${b.title} ${b.kind} ${idx.list.slice(b.start,b.end).filter(c => c.kind === 'lecture').map(c => c.title).join(' ')}`.toLowerCase(),
  }))));
  const input = el('input', { type: 'search', placeholder: 'Try “flexbox” or “cat photo”…', 'aria-label': 'Search the curriculum', autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-controls': 'searchResults', 'aria-autocomplete': 'list', 'aria-expanded': 'true' });
  const results = el('div', { class: 'search-results', id: 'searchResults', role: 'listbox', 'aria-label': 'Matching lessons' });
  const count = el('span', { role: 'status', 'aria-live': 'polite' });
  const close = el('button', { class: 'dialog-close', type: 'button', 'aria-label': 'Close lesson search', onclick: () => dialog.close() }, 'Esc');
  const dialog = el('dialog', { class: 'search-dialog', 'aria-labelledby': 'searchTitle' },
    el('div', { class: 'dialog-top' }, el('h2', { id: 'searchTitle' }, 'Find your next lesson'), close),
    el('div', { class: 'search-input-wrap' }, input), el('div', { class: 'search-caption' }, 'THE WHOLE CURRICULUM. ONE SEARCH.'), results,
    el('div', { class: 'search-footer' }, count, el('span', {}, '↑ ↓ to explore · Enter to open')));
  document.body.append(dialog);
  let selected = 0, items = [];
  const select = (n) => { selected = n; items.forEach((a,i) => { a.classList.toggle('selected', i === n); a.setAttribute('aria-selected', String(i === n)); }); if(items[n]) { input.setAttribute('aria-activedescendant', items[n].id); items[n].scrollIntoView({block:'nearest'}); } else input.removeAttribute('aria-activedescendant'); };
  function draw() {
    const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = records.filter(r => terms.every(t => r.words.includes(t)));
    items = matches.slice(0, 30).map(({b,ch,m},i) => {
      const target = idx.list.slice(b.start,b.end).find(c => !store.isDone(c.id)) ?? idx.list[b.start];
      return el('a', { class: 'search-result', href: `#/c/${target.id}`, id: `search-result-${i}`, role: 'option', tabindex: '-1', onclick: () => dialog.close() }, icon(b.kind === 'workshop' ? 'workshops' : b.kind === 'lab' ? 'labs' : 'book'), el('span', { class: 'search-result-copy' }, el('strong', {}, b.title), el('small', {}, `${ch.title} / ${m.title}`)), el('span', { class: 'block-kind' }, b.kind));
    });
    results.replaceChildren(...(items.length ? items : [el('div', { class: 'search-empty' }, el('strong', {}, 'No lessons found'), el('p', {}, 'Try a topic, project name, or lesson type.'))]));
    count.textContent = matches.length > 30 ? `Showing 30 of ${matches.length} · keep typing to narrow it down` : `${matches.length} results`;
    select(0);
  }
  function openSearch() { if (dialog.open) return; input.value = ''; dialog.showModal(); draw(); input.focus(); }
  input.addEventListener('input', draw);
  input.addEventListener('keydown', e => { if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) { e.preventDefault(); select((selected + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length); } if(e.key === 'Enter' && items[selected]) {e.preventDefault(); const href = items[selected].getAttribute('href'); dialog.close(); go(href);} });
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) dialog.close(); } });
  searchBtn.onclick = openSearch;

  const shortcutRows = [['Ctrl + K', 'Find a lesson'], ['Ctrl + B', 'Toggle navigation'], ['Ctrl + P / N', 'Previous / next step'], ['Ctrl + Shift + G', 'Check your code'], ['Ctrl + M', 'Focus editor / full screen / leave'], ['Ctrl + Q', 'Move between questions'], ['Alt + ↑ / ↓', 'Move between answers'], ['Ctrl + Alt', 'Choose the focused answer'], ['Esc', 'Close a dialog or full screen']];
  const help = el('dialog', { class: 'help-dialog', 'aria-labelledby': 'helpTitle' });
  help.append(el('div', {class:'dialog-top'},el('h2',{id:'helpTitle'},'A few useful shortcuts'),el('button',{class:'dialog-close',type:'button','aria-label':'Close shortcuts',onclick:()=>help.close()},'Esc')),
    el('p',{class:'dialog-description'},'Keep your hands on the keyboard. Stay in your flow.'),el('div',{class:'shortcut-list'},shortcutRows.map(([keys,label])=>el('div',{},el('span',{},label),el('kbd',{},keys)))),el('p',{class:'dialog-note'},'Some desktop browsers reserve Ctrl+N and Ctrl+P. On-screen navigation is always available.'));
  document.body.append(help);
  document.getElementById('shortcutsBtn').onclick = () => help.showModal();
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); if(!help.open) openSearch(); }
    else if(e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest('input,textarea,[contenteditable="true"],.monaco-editor') && !dialog.open && !help.open) { e.preventDefault(); help.showModal(); }
  }, true);
  const status = document.getElementById('offlineStatus');
  const offlineStatus = () => { status.textContent = navigator.serviceWorker?.controller ? 'Offline enabled' : 'Offline-first learning'; };
  navigator.serviceWorker?.addEventListener('controllerchange',offlineStatus); offlineStatus();
}
