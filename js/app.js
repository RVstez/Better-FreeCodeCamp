import { createStore } from './state.js';
import { buildIndex, continueTarget, tally, locate } from './progress.js';
import { blocks, copyLessonReference } from './render.js';
import { codePage, questionsBlock, quizPage } from './code-page.js';
import { disposeEditors } from './monaco-loader.js';
import { el, go, linkBtn, toast } from './dom.js';
import { icon, setupDiscovery } from './ui.js';

const view = document.getElementById('view'), rail = document.getElementById('rail'), ctx = document.getElementById('ctx');
const setView = (...kids) => view.replaceChildren(...kids.flat().filter((x) => x != null)); // native replaceChildren stringifies null/undefined into a literal "null"/"undefined" text node
const bar = (pct, cls = 'progress') => el('div', { class: cls, role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, el('i', { style: `width:${pct}%` }));
const greeting = (h = new Date().getHours()) => h < 5 || h >= 22 ? 'A quiet moment to learn' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
const KIND = { lecture: 'Lecture', workshop: 'Workshop', lab: 'Lab', review: 'Review', quiz: 'Quiz', exam: 'Exam' };
const plural = (n, w) => `${n.toLocaleString()} ${w}${n === 1 ? '' : 's'}`;
const status = (t) => (t.done === 0 ? 'Not started' : t.done === t.total ? 'Complete' : `${t.pct}% complete`);
let manifest, idx, store;
const stats = (a, b) => tally(idx, store.get(), a, b);
const crumbs = (...items) => el('div', { class: 'crumbs' }, items.flatMap((it, i) => [i ? el('span', { class: 'sep' }, '/') : null, it.href ? el('a', { href: it.href }, it.label) : el('span', {}, it.label)]));

const PRACTICE = [['workshops', 'Workshops'], ['labs', 'Labs & Reviews'], ['projects', 'Certification Projects']];
function chapterLinks(activeKey) {
  const link = (key, href, text, symbol, suffix) => el('a', { class: 'nav-link' + (activeKey === key ? ' active' : ''), href, 'aria-current': activeKey === key ? 'page' : null }, icon(symbol), el('span', {}, text), suffix ? el('span', {class:'nav-suffix'},suffix) : null);
  return [link(undefined, '#/', 'Overview', 'home'), el('div', {class:'rail-label rail-group'},'Curriculum'),
    ...manifest.chapters.filter(c => !c.chapterType).map((c,i) => link(c.name, `#/chapter/${c.name}`, c.title, c.name, String(i+1).padStart(2,'0'))),
    el('div', { class: 'rail-label rail-group' }, 'Put it into practice'),
    ...PRACTICE.map(([k, t]) => link('practice:' + k, `#/practice/${k}`, t, k)), link('exam', '#/exam', 'Certification exam', 'exam')];
}
// The sidebar shows the chapters or, inside a multi-step workshop/lecture, that block's own steps. It is rebuilt only when
// what it shows changes; moving between steps just updates the markers, so the list keeps its scroll position (it used to
// jump back to step 1) and the current step is kept in view.
let railKey = '', railCurrent = null;
function markSteps(currentId) {
  document.querySelectorAll('#chapterNav .rail-step').forEach((a) => {
    const cur = a.dataset.id === currentId, done = store.isDone(a.dataset.id);
    a.className = 'rail-step' + (cur ? ' current' : done ? ' done' : '');
    a.querySelector('.num').textContent = done && !cur ? '✓' : a.dataset.n;
    if (cur) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
  });
}
function drawRail(activeChapter, blockLoc, currentId) {
  const nav = document.getElementById('chapterNav'), inBlock = !!blockLoc && blockLoc.of > 1;
  const key = inBlock ? 'block:' + blockLoc.block.name : 'chapters:' + (activeChapter ?? '');
  railCurrent = currentId;
  if (key !== railKey) {
    railKey = key;
    if (!inBlock) nav.replaceChildren(...chapterLinks(activeChapter));
    else nav.replaceChildren(el('a', { class: 'rail-back', href: `#/module/${blockLoc.chapter.name}/${blockLoc.module.name}` }, `\u2190 ${blockLoc.module.title}`), el('div', { class: 'rail-block-title' }, blockLoc.block.title),
      el('div', { class: 'rail-steps' }, idx.list.slice(blockLoc.block.start, blockLoc.block.end).map((s, i) => el('a', { class: 'rail-step', href: `#/c/${s.id}`, 'data-id': s.id, 'data-n': String(i + 1) }, el('span', { class: 'num' }), el('span', { class: 'rail-step-title' }, s.title)))));
  }
  if (!inBlock) return;
  markSteps(currentId);
  const list = nav.querySelector('.rail-steps'), cur = list?.querySelector('.current');
  if (cur) { const top = cur.offsetTop, bottom = top + cur.offsetHeight; if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) list.scrollTop = top - (list.clientHeight - cur.offsetHeight) / 2; }
}
const homeCrumb = { label: 'Overview', href: '#/' };
const nextIn = (b) => idx.list.slice(b.start, b.end).find((c) => !(c.id in store.get().completed)) ?? idx.list[b.start];
const course = (href, title, meta, t, number) => el('a', { class: 'course' + (t && t.done ? '' : ' zero'), href },
  el('span',{class:'course-number'},String(number ?? 1).padStart(2,'0')),
  el('div', {class:'course-copy'}, el('div', { class: 'course-title' }, title), el('div', { class: 'course-meta' }, meta)),
  t ? el('div',{class:'course-measure'},el('span',{},`${t.pct}%`),bar(t.pct, 'course-progress')) : el('div'), icon('arrow','course-arrow'));
const descriptions = { html: 'Give your ideas structure. Learn the elements that make up every page on the web.', computers: 'Get comfortable with the tools, systems, and connections behind the screen.', css: 'Bring your pages to life with thoughtful layouts, typography, and responsive design.' };
function pageHeading(title, detail, t, symbol) {
  return el('header',{class:'page-heading'},el('div',{},symbol ? el('div',{class:'kicker'},icon(symbol),'RESPONSIVE WEB DESIGN') : null,el('h1',{class:'chal-title page-title'},title),el('p',{class:'page-description'},detail)),
    t ? el('div',{class:'page-progress'},el('strong',{},`${t.pct}%`),el('span',{},`${t.done.toLocaleString()} / ${t.total.toLocaleString()} complete`),bar(t.pct)) : null);
}
function blockRow(b, meta) {
  const t = stats(b.start, b.end), complete = t.total > 0 && t.done === t.total, many = b.end - b.start > 1;
  return el('a', { class: 'block-row', href: `#/c/${nextIn(b).id}`, style: t.done && !complete ? `--pct:${t.pct}%` : null },
    el('div', { class: 'block-check' + (complete ? ' done' : t.done ? ' partial' : '') }, complete ? '✓' : ''),
    el('div', {}, el('div', { class: 'block-title' }, b.title), el('div', { class: 'block-meta' }, meta ?? (many ? `${plural(b.end - b.start, 'step')} · ${status(t)}` : status(t)))),
    el('span', { class: 'block-kind' }, KIND[b.kind]));
}
function home() {
  const all = stats(), target = continueTarget(idx, store.get()), started = !!store.get().position || all.done > 0;
  const chapters = idx.chapters.filter(c => !c.chapterType);
  const allBlocks = chapters.flatMap(c=>c.modules.flatMap(m=>m.blocks));
  const projects = chapters.flatMap(c=>c.modules.filter(m=>m.moduleType==='cert-project'));
  const projectsDone = projects.filter(m=>{const t=stats(m.start,m.end);return t.total && t.done===t.total;}).length;
  const blocksDone = allBlocks.filter(b=>{const t=stats(b.start,b.end);return t.total && t.done===t.total;}).length;
  ctx.textContent = 'Workspace / Overview'; drawRail();
  const cont = target ? (() => { const l = locate(idx, target.id), t=stats(l.block.start,l.block.end); return el('section', { class: 'continue' },
    el('div',{class:'continue-top'},el('span',{class:'continue-label'},el('span',{class:'status-dot'}),started ? 'PICK UP WHERE YOU LEFT OFF' : 'YOUR FIRST STEP'),el('span',{class:'badge'},KIND[l.block.kind])),
    el('div',{class:'continue-main'},el('div',{},el('div', { class: 'continue-title' }, l.block.kind === 'workshop' ? l.block.title : target.title), el('div', { class: 'continue-meta' }, `${l.chapter.title} / ${l.module.title}`)), linkBtn(started ? 'Continue learning \u2192' : 'Start learning \u2192', `#/c/${target.id}`)),
    el('div',{class:'continue-bottom'},el('span',{},`Step ${l.step} of ${l.of}`),bar(t.pct),el('span',{},t.done ? `${t.done} complete` : 'A good place to begin'))); })()
    : el('section', { class: 'continue complete-course' }, icon('check'),el('div', { class: 'continue-title' }, 'Look how far you’ve come.'),el('p',{},'Every lesson completed. Keep your skills sharp with a little practice.'),linkBtn('Explore workshops \u2192','#/practice/workshops'));
  const saved = store.status.ok;
  const practiceCards = [
    ['workshops','Workshops','Build with a little guidance.',allBlocks.filter(b=>b.kind==='workshop').length],
    ['labs','Labs & reviews','Make it yours. Test what you know.',allBlocks.filter(b=>(b.kind==='lab'||b.kind==='review')&&!projects.some(m=>b.start>=m.start&&b.end<=m.end)).length],
    ['projects','Certification projects','Put all the pieces together.',projects.length],
  ];
  setView(el('section', { class: 'hero' }, el('div', {}, el('div', { class: 'kicker' },`${greeting()}. Make a little room to learn.`),el('h1',{},'Small steps.',el('br'),el('span',{},'Real progress.')),el('p',{},'Build your web development skills at your own pace. Your next step is right here.'))),
    el('div',{class:'dashboard-grid'},el('div',{class:'dashboard-main'},cont,
      el('section',{class:'curriculum-section'},el('div',{class:'section-head'},el('div',{},el('span',{class:'section-eyebrow'},'THE LEARNING PATH'),el('h2',{},'Your curriculum')),el('span',{},`${chapters.length} CHAPTERS`)),
        el('div',{class:'catalog home-catalog'},chapters.map((ci,i)=>{const t=stats(ci.start,ci.end);return el('a',{class:'course chapter-course',href:`#/chapter/${ci.name}`},el('div',{class:'chapter-glyph'},icon(ci.name)),el('div',{class:'course-copy'},el('div',{class:'course-title'},ci.title,el('span',{class:'chapter-index'},String(i+1).padStart(2,'0'))),el('div',{class:'course-meta'},`${plural(ci.modules.length,'module')} · ${plural(t.total,'lesson')}`)),el('div',{class:'course-measure'},el('span',{},t.done ? `${t.pct}%` : 'Not started'),bar(t.pct,'course-progress')),icon('arrow','course-arrow'));}))),
      el('section',{class:'small-section'},el('div',{class:'section-head'},el('div',{},el('span',{class:'section-eyebrow'},'LEARN BY DOING'),el('h2',{},'Make something of it.'))),el('div',{class:'practice-grid'},practiceCards.map(([k,title,detail,n])=>el('a',{class:'practice-card',href:`#/practice/${k}`},el('div',{class:'practice-card-top'},icon(k),icon('arrow')),el('h3',{},title),el('p',{},detail),el('span',{class:'practice-count'},`${n} ${k==='projects'?'projects':k==='labs'?'exercises':'workshops'}`)))))),
    el('aside',{class:'journey-panel','aria-label':'Your learning progress'},el('div',{class:'section-eyebrow'},'THE BIG PICTURE'),el('h2',{},'Your journey'),el('div',{class:'journey-ring',style:`--progress:${all.pct}%`,'aria-label':`${all.pct}% of curriculum completed`},el('div',{},el('strong',{},String(all.pct),el('span',{},'%')),el('small',{},'COMPLETE'))),el('p',{class:'journey-caption'},all.done ? `${all.done.toLocaleString()} steps forward. Keep going.` : 'Every expert started at zero.'),
      el('div',{class:'journey-stats'},el('div',{},el('span',{},'Lessons completed'),el('strong',{},all.done.toLocaleString(),el('small',{},` / ${all.total.toLocaleString()}`))),el('div',{},el('span',{},'Topics finished'),el('strong',{},blocksDone,el('small',{},` / ${allBlocks.length}`))),el('div',{},el('span',{},'Projects built'),el('strong',{},projectsDone,el('small',{},` / ${projects.length}`)))),
      el('div',{class:'journey-note'},icon('book'),el('p',{},'No rush. No streak to lose.',el('span',{},'Just you, getting a little better.'))),el('a',{class:'exam-link',href:'#/exam'},'About certification',icon('arrow')))),
    el('footer', { class: 'footer' },el('span',{},el('span',{class:'status-dot'}),saved ? 'Your progress stays on this device' : 'Storage full or blocked — progress is not being saved'),el('span',{},'RESPONSIVE WEB DESIGN · V9')));
}
function chapter(name) {
  const ci = idx.chapters.find(c => c.name === name); if (!ci) return notFound();
  ctx.textContent = `Curriculum / ${ci.title}`; drawRail(name);
  setView(crumbs(homeCrumb, {label:ci.title}),pageHeading(ci.title,descriptions[name] ?? 'Explore the next part of your learning path.',stats(ci.start,ci.end),name),
    el('div',{class:'section-head list-heading'},el('h2',{},'Your modules'),el('span',{},`${ci.modules.length} MODULES · IN CURRICULUM ORDER`)),
    el('div',{class:'catalog'},ci.modules.map((m,i)=>{const t=stats(m.start,m.end);return course(`#/module/${ci.name}/${m.name}`,m.title,`${plural(t.total,'lesson')} · ${m.moduleType==='cert-project'?'Certification project':status(t)}`,t,i+1);})));
}
function moduleView(chName, modName) {
  const ci=idx.chapters.find(c=>c.name===chName),m=ci?.modules.find(x=>x.name===modName);if(!m)return notFound();
  ctx.textContent=`${ci.title} / ${m.title}`;drawRail(chName);const t=stats(m.start,m.end);
  setView(crumbs(homeCrumb,{label:ci.title,href:`#/chapter/${ci.name}`},{label:m.title}),pageHeading(m.title,`${plural(m.blocks.length,'topic')} to explore. Read, build, and put your understanding to the test.`,t),
    el('div',{class:'section-head list-heading'},el('h2',{},'Inside this module'),el('span',{},'PICK UP ANYWHERE')),
    el('div',{class:'rows-list'},m.blocks.map(b=>blockRow(b))));
}
function practice(kind) {
  const title=new Map(PRACTICE).get(kind);if(!title)return notFound();
  ctx.textContent=`Practice / ${title}`;drawRail('practice:'+kind);const rows=[];
  for(const ci of idx.chapters)for(const m of ci.modules)for(const b of m.blocks){
    const hit=kind==='workshops'?b.kind==='workshop':kind==='labs'?(b.kind==='lab'||b.kind==='review')&&m.moduleType!=='cert-project':m.moduleType==='cert-project';
    if(hit)rows.push(blockRow(b,`${ci.title} · ${m.title}`));
  }
  const filter=el('input',{class:'list-filter',type:'search',placeholder:'Filter by name or topic…','aria-label':`Filter ${title.toLowerCase()}`}),count=el('span',{class:'filter-count',role:'status'},`${rows.length} available`),empty=el('p',{class:'empty-state',hidden:true},'No matches. Try another topic.');
  filter.oninput=()=>{const q=filter.value.trim().toLowerCase();let n=0;for(const r of rows){r.hidden=!r.textContent.toLowerCase().includes(q);if(!r.hidden)n++;}count.textContent=`${n} available`;empty.hidden=n>0;};
  const detail=kind==='workshops'?'Turn an idea into a working page, one guided step at a time.':kind==='labs'?'Try it yourself, then revisit the concepts that make it click.':'Bring everything you have learned into a complete project.';
  setView(crumbs(homeCrumb,{label:title}),pageHeading(title,detail),el('div',{class:'list-toolbar'},filter,count),el('div',{class:'rows-list'},rows),empty);
}
async function exam() {
  ctx.textContent = 'CERTIFICATION EXAM'; drawRail('exam');
  const item = idx.list.find((c) => c.kind === 'exam'); if (!item) return notFound();
  const loc = locate(idx, item.id); let desc = null;
  try { desc = (await loadBlock(loc.block.name)).challenges[0].description; } catch { /* the page still explains itself without it */ }
  if (location.hash !== '#/exam') return;
  setView(crumbs(homeCrumb, { label: 'Certification Exam' }), el('div', { class: 'exam-panel' }, el('h2', {}, item.title === 'Responsive Web Design Certification Exam' ? item.title : loc.block.title),
    desc ? el('div', { class: 'prose', style: 'margin:0 auto 18px' }, blocks(desc)) : null,
    el('p', {}, 'The exam is taken in freeCodeCamp’s own exam environment app. The curriculum export this app is built from contains only that pointer — no exam questions — so there is nothing to practise here beyond the projects and quizzes.'),
    linkBtn('Open the reference entry \u2192', `#/c/${item.id}`)));
}
const chunks = new Map();
// A failed or hung request used to be cached as a permanently-pending promise, so that lesson could never load again until a
// page refresh. Now: it times out, is forgotten on failure, and the page offers a retry.
async function fetchJson(url, ms = 12000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return await r.json(); } finally { clearTimeout(t); }
}
const loadBlock = (name) => {
  if (!chunks.has(name)) chunks.set(name, fetchJson(`data/blocks/${name}.json`).catch((e) => { chunks.delete(name); throw e; }));
  return chunks.get(name);
};
async function challenge(id) {
  const loc = locate(idx, id); if (!loc) return notFound();
  store.visit(id); ctx.textContent = `${loc.chapter.title} / ${loc.module.title}`.toUpperCase(); drawRail(manifest.chapters.find((m) => m.name === loc.chapter.name)?.chapterType === 'exam' ? 'exam' : loc.chapter.name, loc, id);
  const slow = setTimeout(() => { if (location.hash === `#/c/${id}`) setView(el('p', { class: 'muted-note' }, 'Loading lesson…')); }, 350);
  let chunk;
  try { chunk = await loadBlock(loc.block.name); }
  catch { clearTimeout(slow); if (location.hash !== `#/c/${id}`) return; setView(el('h1', {}, 'Could not load this lesson'), el('p', { class: 'muted-note' }, 'The local server did not answer. Make sure it is still running (and that Termux is not paused or battery-restricted), then try again.'), el('button', { class: 'btn', type: 'button', onclick: () => challenge(id) }, 'Try again')); return; }
  clearTimeout(slow);
  const c = chunk.challenges[loc.challenge.index];
  if (location.hash !== `#/c/${id}`) return;
  const kind = loc.block.kind, list = idx.list.slice(loc.block.start, loc.block.end);
  const head = el('div', { class: 'chal-head' }, el('div', { class: 'chal-kicker' }, el('span', { class: 'tag' }, KIND[kind]), loc.of > 1 ? el('span', {}, `Step ${loc.step} of ${loc.of}`) : null, loc.module.moduleType === 'cert-project' ? el('span', { class: 'tag' }, 'Certification Project') : null), el('h1', { class: 'chal-title' }, kind === 'workshop' ? loc.block.title : c.title));
  const dense = list.length > 24;
  const steps = list.length > 1 ? el('div', { class: 'step-nav' }, el('div', { class: 'step-dots' + (dense ? ' dense' : ''), role: 'group', 'aria-label': 'Steps in this lesson' }, list.map((x, i) => el('button', { type: 'button', class: 'step-dot ' + (x.id === id ? 'current' : x.id in store.get().completed ? 'done' : ''), title: `${i + 1}. ${x.title}`, 'aria-label': `Step ${i + 1}: ${x.title}`, 'aria-current': x.id === id ? 'step' : null, onclick: () => go(`#/c/${x.id}`) }))), el('div', { class: 'step-count' }, `${loc.step} / ${loc.of}`)) : null;
  const doneBar = () => el('div', { class: 'completion' }, el('div', { class: 'completion-status' + (store.isDone(id) ? '' : ' incomplete') }, el('span', { class: 'dot' }), el('span', {}, store.isDone(id) ? '✓ Completed' : 'Not completed yet')),
    el('div', { class: 'nav-buttons' }, loc.prev ? linkBtn('\u2190 Back', `#/c/${loc.prev.id}`, 'ghost sm', 'prev') : null, loc.next ? linkBtn(kind === 'quiz' ? 'Next lesson \u2192' : 'Next \u2192', `#/c/${loc.next.id}`, 'sm', 'next') : null));
  let body;
  if (c.hints && (kind === 'workshop' || kind === 'lab')) body = codePage({ c, loc, store });
  else if (c.questions) body = el('div', {}, el('div', { class: 'prose' }, blocks(c.interactive ?? c.description)), questionsBlock({ c, store, onDone: () => document.querySelector('.completion')?.replaceWith(doneBar()) }), doneBar());
  else if (c.sets) body = el('div', {}, el('div', { class: 'prose' }, blocks(c.description ?? c.interactive)), quizPage({ c, store, onDone: () => document.querySelector('.completion')?.replaceWith(doneBar()) }), c.assignment ? el('div', { class: 'prose' }, blocks(c.assignment)) : null, doneBar());
  else if (kind === 'review') {
    const host = el('div', {}), mark = el('button', { class: 'btn sm', type: 'button' }, 'Mark reviewed');
    const draw = () => { host.replaceChildren(doneBar()); if (!store.isDone(id)) host.querySelector('.completion').append(mark); };
    mark.onclick = () => { store.complete(id); toast('✓ Reviewed'); draw(); }; draw();
    body = el('div', {}, el('div', { class: 'prose' }, blocks(c.description ?? c.interactive)),
      c.assignment ? el('div', { class: 'panel', style: 'margin-top:26px' }, el('div', { class: 'panel-head' }, el('span', { class: 'ph-label' }, 'Assignment')), el('div', { class: 'prose', style: 'padding:16px 18px 2px' }, blocks(c.assignment))) : null, host);
  }
  else body = el('div', {}, el('div', { class: 'prose' }, blocks(c.description ?? c.interactive)), c.assignment ? el('div', { class: 'prose' }, blocks(c.assignment)) : null, doneBar());
  view.classList.add(c.hints && (kind === 'workshop' || kind === 'lab') ? 'wide' : 'reading'); setView(crumbs({ label: 'Overview', href: '#/' }, { label: loc.chapter.title, href: `#/chapter/${loc.chapter.name}` }, { label: loc.module.title, href: `#/module/${loc.chapter.name}/${loc.module.name}` }, { label: loc.block.title }), head, steps, body);
}
const notFound = () => setView(el('h1', {}, 'Not found'), el('a', { href: '#/' }, '\u2190 Back to the curriculum'));
function route() {
  flushEditors(); // save what was typed in the page being left before its editors are torn down
  disposeEditors(); // Monaco editors are not freed just because their container leaves the page
  document.body.classList.remove('editor-full');
  const [, kind, arg, arg2] = location.hash.split('/'); closeSidebar(false); view.classList.remove('wide','reading'); view.dataset.page = kind || 'home';
  (kind === 'chapter' ? chapter(arg) : kind === 'module' ? moduleView(arg, arg2) : kind === 'practice' ? practice(arg) : kind === 'exam' ? exam() : kind === 'c' ? challenge(arg) : home()); window.scrollTo(0, 0);
}
const narrow = () => matchMedia('(max-width: 760px)').matches;
function syncSidebar() {
  const open = rail.classList.contains('open'), mobile=narrow();
  document.getElementById('railScrim').hidden=!(mobile && open);
  document.getElementById('menuBtn').setAttribute('aria-expanded',String(mobile ? open : !document.body.classList.contains('rail-collapsed')));
  rail.inert=mobile && !open;
  document.querySelector('.main').inert=mobile && open;
  document.body.classList.toggle('nav-open',mobile && open);
}
function closeSidebar(focus=true) { const wasOpen=rail.classList.contains('open');rail.classList.remove('open');syncSidebar();if(wasOpen && focus)document.getElementById('menuBtn').focus(); }
function toggleSidebar() {
  if(narrow()){const open=!rail.classList.contains('open');rail.classList.toggle('open',open);syncSidebar();if(open)document.getElementById('closeRail').focus();return;}
  const on=!document.body.classList.contains('rail-collapsed');document.body.classList.toggle('rail-collapsed',on);store.setSetting('railCollapsed',on);syncSidebar();
}
const flushEditors = () => document.querySelectorAll('.editor-shell').forEach((sh) => sh.rvstez?.flush());
// ⋯ menu: export / import / reset the learner's progress (the storage layer already supported all three; nothing exposed them)
function setupMenu() {
  const btn = document.getElementById('moreBtn'); if (!btn) return;
  const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  const item = (text, fn, cls = '') => el('button', { class: ('menu-item ' + cls).trim(), role: 'menuitem', type: 'button', onclick: () => { close(); fn(); } }, text);
  const menu = el('div', { class: 'menu', role: 'menu', hidden: true }, item('Export progress', exportProgress), item('Import progress…', () => file.click()), item('Reset all progress…', resetProgress, 'danger'));
  document.body.append(menu, file);
  function close(refocus = false) { const wasOpen = !menu.hidden; menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (wasOpen && refocus) btn.focus(); }
  btn.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) { const r = btn.getBoundingClientRect(); menu.style.top = r.bottom + 6 + 'px'; menu.style.right = innerWidth - r.right + 'px'; menu.querySelector('.menu-item').focus(); } };
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll('.menu-item')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1].focus(); }
    if (e.key === 'Tab') close();
  });
  addEventListener('click', () => close()); addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); close(true); } });
  file.onchange = async () => {
    const f = file.files[0]; file.value = ''; if (!f) return;
    try { const sum = store.import(await f.text(), { merge: true }); toast(`Imported: ${sum.completed} newly completed, ${sum.code} saved code`); route(); } catch (e) { toast('Could not import: ' + e.message); }
  };
}
function exportProgress() {
  const a = el('a', { href: URL.createObjectURL(new Blob([store.export()], { type: 'application/json' })), download: `better-freecodecamp-progress-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Progress exported');
}
function resetProgress() {
  if (!confirm('Reset ALL progress and saved code on this device? This cannot be undone.')) return;
  try { store.reset(); toast('Progress reset'); railKey = ''; location.hash = '#/'; route(); } catch (e) { toast(e.message); }
}
async function start() {
  try {
    manifest = await (await fetch('data/manifest.json')).json(); idx = buildIndex(manifest); store = createStore(); window.rvstez = { store, idx };
    document.body.classList.toggle('rail-collapsed', !!store.get().settings.railCollapsed && !narrow());
    document.getElementById('menuBtn').onclick = toggleSidebar;
    document.getElementById('closeRail').onclick = () => closeSidebar(); document.getElementById('railScrim').onclick = () => closeSidebar();
    addEventListener('resize',syncSidebar); addEventListener('keydown',e=>{if(e.key==='Escape' && rail.classList.contains('open') && !document.querySelector('dialog[open]'))closeSidebar();});
    rail.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !narrow() || !rail.classList.contains('open')) return;
      const items = [...rail.querySelectorAll('a[href],button:not([disabled])')].filter(x=>x.getClientRects().length);
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1).focus(); }
      if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0].focus(); }
    });
    setupDiscovery({idx,store}); setupMenu(); syncSidebar();
    store.subscribe(() => { if (railKey.startsWith('block:')) markSteps(railCurrent); });
    addEventListener('hashchange', route); route();
    addEventListener('keydown', globalShortcuts, true); // capture phase: our shortcuts take precedence over Monaco's own bindings for the same keys (it binds Ctrl+M and Ctrl+G)
    addEventListener('pagehide', flushEditors);
    if (new URLSearchParams(location.search).has('keys')) { // diagnostic: open the app with ?keys to see every key event's modifier state on screen
      const box = el('div', { class: 'keys-debug' }, 'press a key…'); document.body.append(box);
      for (const t of ['keydown', 'keyup']) addEventListener(t, (ev) => { box.textContent = `${t === 'keydown' ? '\u2193' : '\u2191'} ${ev.key}   ctrl:${+ev.ctrlKey} shift:${+ev.shiftKey} alt:${+ev.altKey}   in:${document.activeElement?.tagName}`; }, true);
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}); // offline copy of the app: see sw.js
  } catch (e) { setView(el('h1', {}, 'Could not load the curriculum'), el('p', { class: 'muted-note' }, String(e.message))); }
}

// ---- keyboard ----
// Ctrl+B sidebar · Ctrl+P / Ctrl+N previous / next step · Ctrl+Shift+G check (leaves the editor and shows the results) ·
// Ctrl+M editor: focus it \u2192 full screen \u2192 leave · Ctrl+Shift+Y copy a lesson reference · Ctrl+Q cycle questions · Alt+\u2191/\u2193 move between answers · Ctrl+Alt pick the focused answer.
function nearestShell() {
  const list = [...document.querySelectorAll('.editor-shell')]; if (!list.length) return null;
  const focused = list.find((sh) => sh.rvstez?.hasFocus()); if (focused) return focused;
  const mid = innerHeight / 2, dist = (sh) => { const r = sh.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - mid); };
  return list.sort((a, b) => dist(a) - dist(b))[0];
}
const showChecks = () => requestAnimationFrame(() => document.querySelector('.run-bar')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
// Moving focus or leaving the page in the middle of a key chord (Ctrl+Shift+… still held) can leave a modifier latched on some Android
// keyboards — afterwards plain arrow keys select text as if Shift were down. So anything that changes focus waits until the modifier keys
// are up (or 1.5s at most).
function afterRelease(fn) {
  let done = false; const run = () => { if (done) return; done = true; removeEventListener('keyup', onUp, true); clearTimeout(t); fn(); };
  const onUp = (e) => { if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) run(); }, t = setTimeout(run, 1500);
  addEventListener('keyup', onUp, true);
}
function globalShortcuts(e) {
  if(document.querySelector('dialog[open]'))return;
  const k = e.key.toLowerCase(), inEditor = !!e.target.closest?.('.monaco-editor');
  const take = () => { e.preventDefault(); e.stopPropagation(); };
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && k === 'y') {
    take(); e.stopImmediatePropagation(); if (!e.repeat) afterRelease(copyLessonReference); return;
  }
  if (e.ctrlKey && !e.altKey && !e.shiftKey) {
    if (k === 'b') { take(); toggleSidebar(); return; }
    if ((k === 'p' || k === 'n') && document.querySelector(`[data-nav=${k === 'p' ? 'prev' : 'next'}]`)) { take(); const sel = `[data-nav=${k === 'p' ? 'prev' : 'next'}]`; if (!e.repeat) afterRelease(() => document.querySelector(sel)?.click()); return; }
    if (k === 'm') {
      const sh = nearestShell(); if (!sh) return; take(); if (e.repeat) return;
      afterRelease(() => { const api = sh.rvstez; if (api.isFull()) { api.setFull(false); api.blur(); showChecks(); } else if (api.hasFocus()) api.setFull(true); else api.focus(); });
      return;
    }
    if (k === 'q' && document.querySelector('.quiz-q')) { take(); cycleQuizItem(); return; }
  }
  if (e.ctrlKey && e.shiftKey && !e.altKey && k === 'g') {
    const run = document.querySelector('.run-bar .btn'); if (!run) return; take(); if (e.repeat) return;
    run.click(); // the check starts at once; leaving the editor and showing the results waits for the keys to be released
    afterRelease(() => { const sh = nearestShell(); if (sh) { sh.rvstez.setFull(false); sh.rvstez.blur(); } showChecks(); }); return;
  }
  if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !inEditor && document.querySelector('.quiz-choices')) { take(); moveAnswerFocus(e.key === 'ArrowDown' ? 1 : -1); return; }
  if (e.ctrlKey && e.altKey && !e.shiftKey && document.activeElement?.classList.contains('quiz-choice')) {
    take(); document.activeElement.click(); setTimeout(() => document.querySelector('.quiz-feedback:not([hidden])')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
  }
}
function cycleQuizItem() {
  const qs = [...document.querySelectorAll('.quiz-q')]; if (!qs.length) return;
  const cur = document.activeElement?.closest('.quiz-q'), next = qs[cur ? (qs.indexOf(cur) + 1) % qs.length : 0];
  next.scrollIntoView({ behavior: 'smooth', block: 'center' }); next.querySelector('.quiz-choice')?.focus({ preventScroll: true });
}
function moveAnswerFocus(dir) {
  const group = document.activeElement?.closest('.quiz-choices') ?? document.querySelector('.quiz-q .quiz-choices'); if (!group) return;
  const opts = [...group.querySelectorAll('.quiz-choice')], i = opts.indexOf(document.activeElement);
  opts[i < 0 ? 0 : (i + dir + opts.length) % opts.length].focus();
}
start();

