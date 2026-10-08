import { blocks, inline, asChoiceCode } from './render.js';
import { runChecks } from './runner.js';
import { createEditorShell } from './editor-shell.js';
import { debounce } from './preview.js';
import { el, linkBtn, toast } from './dom.js';

// Workshop steps and labs: read, write, watch the preview, check with the real tests, continue. The editor is Monaco
// inside an editor shell (tools + full screen); what you type is autosaved, so a refresh never loses work.
export function codePage({ c, loc, store }) {
  const seed = c.seed.files.length ? c.seed.files : [{ lang: 'html', contents: '' }];
  const saved = store.getCode(c.id) ?? {};
  const persist = (files) => store.saveCode(c.id, Object.fromEntries(files.map((f) => [f.lang, f.contents])));
  let dirty = false;
  const autosave = debounce(() => { if (!shell.root.isConnected || !dirty) return; const ok = persist(shell.getFiles()); dirty = false; shell.setSaved(ok === false ? 'Not saved' : 'Saved'); }, 1200);
  const shell = createEditorShell({
    files: seed.map((f) => ({ lang: f.lang })), values: seed.map((f) => saved[f.lang] ?? f.contents), seedValues: seed.map((f) => f.contents),
    label: seed[0].lang === 'html' ? 'index.html' : seed[0].lang === 'css' ? 'styles.css' : 'script.js', onCheck: () => btn.click(),
    onInput: (files, now) => { if (now) { if (dirty) { persist(files); dirty = false; } } else { dirty = true; shell.setSaved(''); autosave(); } },
  });

  const rows = c.hints.map((h) => el('div', { class: 'result-row' }, el('div', { class: 'result-mark' }, '○'), el('div', { class: 'result-text' }, inline(h.text[0]?.c ?? []))));
  const results = el('div', { class: 'results' }, rows);
  const status = el('span', { class: 'run-status', role: 'status', 'aria-live': 'polite' });
  const setStatus = (t) => { status.textContent = t; shell.setStatus(t); };
  const btn = el('button', { class: 'btn', type: 'button' }, 'Check your code');
  const completion = el('div', { class: 'completion' });
  const drawCompletion = () => completion.replaceChildren(
    el('div', { class: 'completion-status' + (store.isDone(c.id) ? '' : ' incomplete') }, el('span', { class: 'dot' }), el('span', {}, store.isDone(c.id) ? '✓ Completed' : 'Not completed yet')),
    el('div', { class: 'nav-buttons' }, loc.prev ? linkBtn('← Back', `#/c/${loc.prev.id}`, 'ghost sm', 'prev') : null, loc.next ? linkBtn('Next →', `#/c/${loc.next.id}`, 'sm', 'next') : null));
  drawCompletion();

  btn.onclick = async () => {
    if (btn.disabled) return;
    btn.disabled = true; setStatus('Running checks…'); const files = shell.getFiles(); persist(files); dirty = false;
    try {
      const res = await runChecks({ files, tests: c.hints.map((h) => h.test), beforeEach: c.beforeEach, onStatus: setStatus });
      res.forEach((r, i) => {
        const m = rows[i].querySelector('.result-mark'); m.className = 'result-mark ' + (r.pass ? 'pass' : 'fail'); m.textContent = r.pass ? '✓' : '✕';
        rows[i].querySelector('.muted-note')?.remove();
        if (!r.pass) rows[i].querySelector('.result-text').append(el('div', { class: 'muted-note', style: 'margin-top:4px' }, r.msg));
      });
      const n = res.filter((r) => r.pass).length;
      setStatus(`${n} / ${res.length} passed`);
      const { allPassed } = store.recordCheck(c.id, res); drawCompletion(); if (allPassed) toast('✓ All checks passed');
    } catch (e) { setStatus('Could not run the tests: ' + e.message); }
    btn.disabled = false;
  };
  return el('div', { class: 'coding-lesson' },
    el('aside', { class: 'lesson-brief', 'aria-label': 'Step instructions' }, el('div', { class: 'section-eyebrow' }, `YOUR TASK · STEP ${loc.step}`), el('div', { class: 'prose' }, blocks(c.description)), el('div', { class: 'lesson-brief-note' }, 'Write → preview → check.', el('br'), 'Your code saves as you go.')),
    el('div', { class: 'lesson-workspace' }, shell.root, el('div', { class: 'run-bar' }, btn, status, el('span', { class: 'run-hint' }, 'Ctrl + Shift + G')), el('div', { class: 'results-title' }, `Checks · ${c.hints.length}`), results, completion));
}

// Lecture questions: pick an answer, get its feedback, complete when every question is right.
export function questionsBlock({ c, store, onDone }) {
  const got = new Set(); const root = el('div', {});
  c.questions.forEach((q, qi) => {
    const fb = el('div', { class: 'quiz-feedback', hidden: '' }); const btns = [];
    const choices = el('div', { class: 'quiz-choices' }, q.answers.map((a, ai) => {
      const code = asChoiceCode(a.text); const b = el('button', { class: 'quiz-choice', type: 'button' }); b.append(code ? el('code', { class: 'choice-code' }, code) : blocks(a.text));
      b.onclick = () => {
        if (got.has(qi)) return; // already solved: leave it as it is
        btns.forEach((x) => x.classList.remove('selected', 'correct', 'incorrect')); const ok = ai === q.correct;
        b.classList.add(ok ? 'correct' : 'incorrect'); fb.hidden = false; fb.setAttribute('role', 'status'); fb.replaceChildren(ok ? 'Correct. Nicely done.' : a.feedback ? blocks(a.feedback) : 'Not quite. Give it another try.');
        btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        if (ok) { got.add(qi); toast('Correct'); if (got.size === c.questions.length) { store.complete(c.id); toast('✓ Lesson complete'); onDone?.(); } }
      };
      btns.push(b); return b;
    }));
    root.append(el('div', { class: 'quiz-q inline-q' }, el('div', { class: 'inline-q-label' }, c.questions.length > 1 ? `Check your understanding · ${qi + 1} of ${c.questions.length}` : 'Check your understanding'), el('div', { class: 'prose' }, blocks(q.text)), choices, fb));
  });
  return root;
}

// Real quizzes: freeCodeCamp ships several question SETS per quiz (variations); each attempt draws one set,
// cycling deterministically through them so repeat attempts see different questions rather than a shuffled
// re-ask of the same ones. Selection per question is single-choice until Submit; scoring uses the quiz's own
// real pass threshold (e.g. 18/20), never an invented one.
function shuffle(list, seed) { // small deterministic shuffle so re-render (e.g. on resize) doesn't reorder options mid-attempt
  const a = list.map((v, i) => [v, i]); let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function quizPage({ c, store, onDone }) {
  const root = el('div', { class: 'quiz-flow' });
  const best = () => (store.get().quizAttempts[c.id] ?? []).reduce((m, x) => (!m || x.score > m.score ? x : m), null);
  const total = c.sets[0].questions.length;

  function intro() {
    const b = best(), start = el('button', { class: 'btn', type: 'button', style: 'margin-top:6px' }, b ? 'Retake quiz' : 'Start quiz'); start.onclick = begin;
    root.replaceChildren(el('div', { class: 'quiz-intro' }, el('h2', {}, 'A moment to check in.'), el('p', {}, 'See what has clicked. Answer one question at a time, review the feedback, and move on when you’re ready.'),
      b ? el('div', { class: 'panel' }, el('div', { class: 'panel-head' }, el('span', { class: 'ph-label' }, 'Best attempt')),
        el('div', { style: 'padding:16px 18px' }, el('span', { class: 'badge' + (b.passed ? ' done' : '') }, b.passed ? 'Passed' : 'Not passed'), el('span', { class: 'muted-note', style: 'margin-left:10px' }, `${b.score} / ${b.of}`))) : null,
      el('div', { class: 'quiz-facts' }, el('span', {}, el('strong', {}, String(total)), 'QUESTIONS'), el('span', {}, el('strong', {}, `${c.pass.required} / ${c.pass.of}`), 'TO PASS'), el('span', {}, el('strong', {}, 'No timer'), 'YOUR OWN PACE')), start));
  }
  // Each attempt draws the next of the quiz's real question sets (freeCodeCamp ships several variations), in a fresh option order.
  function begin() {
    const attempts = (store.get().quizAttempts[c.id] ?? []).length, setIndex = attempts % c.sets.length;
    const qs = c.sets[setIndex].questions.map((q, qi) => ({ ...q, options: shuffle([...q.distractors, q.answer], qi * 7919 + setIndex * 131 + attempts) }));
    const answerAt = (q) => q.options.findIndex(([, i]) => i === q.distractors.length);
    let n = 0, correct = 0;
    function ask() {
      if (!root.isConnected) return; // the learner left the page
      const q = qs[n]; let answered = false; const btns = [];
      const feedback = el('span', { class: 'quiz-answer-status', role: 'status', 'aria-live': 'polite' }, 'Choose the answer that fits best.');
      const next = el('button', { class: 'btn', type: 'button', disabled: true }, n + 1 === qs.length ? 'See results →' : 'Next question →');
      next.onclick = () => { if (!answered) return; ++n < qs.length ? ask() : finish(); root.querySelector('.quiz-q, .quiz-result')?.focus({ preventScroll: true }); };
      const choices = el('div', { class: 'quiz-choices' }, q.options.map(([opt], oi) => {
        const code = asChoiceCode(opt), b = el('button', { class: 'quiz-choice', type: 'button' }); b.append(code ? el('code', { class: 'choice-code' }, code) : blocks(opt));
        b.onclick = () => {
          if (answered) return; answered = true; const right = answerAt(q); if (oi === right) correct++;
          btns.forEach((x, k) => { x.classList.toggle('correct', k === right); x.classList.toggle('incorrect', k === oi && oi !== right); x.setAttribute('aria-pressed', String(k === oi)); x.setAttribute('aria-disabled', 'true'); });
          feedback.textContent = oi === right ? 'Correct. Nicely done.' : 'Not quite. The correct answer is highlighted.';
          next.disabled = false;
        };
        btns.push(b); return b;
      }));
      root.replaceChildren(el('div', { class: 'quiz-progress' }, `Question ${n + 1} of ${qs.length}`), el('div', { class: 'quiz-meter', role: 'progressbar', 'aria-label': 'Quiz progress', 'aria-valuenow': n, 'aria-valuemin': 0, 'aria-valuemax': qs.length }, el('i', { style: `width:${n / qs.length * 100}%` })), el('div', { class: 'quiz-q', tabindex: '-1' }, el('div', { class: 'prose' }, blocks(q.text)), choices), el('div', { class: 'quiz-next' }, feedback, next));
    }
    function finish() {
      const passed = correct >= c.pass.required; store.recordQuiz(c.id, { score: correct, of: qs.length, passed });
      const back = el('button', { class: 'btn ghost', type: 'button' }, 'Back'), again = el('button', { class: 'btn', type: 'button' }, 'Retake'); back.onclick = intro; again.onclick = begin;
      root.replaceChildren(el('div', { class: 'quiz-result', tabindex: '-1' }, el('div', { class: 'quiz-verdict ' + (passed ? 'pass' : 'fail') }, passed ? 'Passed' : 'Not passed'), el('div', { class: 'quiz-score' }, `${correct} / ${qs.length}`),
        el('p', { class: 'muted-note' }, `Passing requires at least ${c.pass.required} of ${c.pass.of}.`), el('div', { style: 'display:flex;gap:10px;justify-content:center;margin-top:24px' }, back, again)));
      toast(passed ? '✓ Quiz passed' : 'Not passed this time'); onDone?.();
    }
    ask();
  }
  intro();
  return root;
}
