// Small shared DOM helpers. No innerHTML anywhere: everything is built with createElement/textContent.
// `el` sets on*-handlers as properties (setAttribute would turn a function into a useless string), drops
// null/undefined children (native append() would print them as the text "null"), and flattens arrays.
export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat(Infinity).filter((x) => x != null && x !== false));
  return e;
};
export const go = (href) => { location.hash = href.replace(/^#/, ''); };
// A real <button> that navigates. (Links styled as buttons pick up the browser's underline and behave differently.)
export const linkBtn = (label, href, cls = '', nav) => el('button', { class: ('btn ' + cls).trim(), type: 'button', 'data-nav': nav, onclick: () => go(href) }, label);

let toastTimer;
export function toast(message) {
  let t = document.getElementById('toast');
  if (!t) { t = el('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.textContent = message; t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
