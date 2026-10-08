// Runs a challenge's ORIGINAL tests in freeCodeCamp's own DOM test runner (curriculum-helpers 9.0.1), in its sandboxed iframe.
// Contract (derived from the tests themselves, verified in tools/proof): keep the <link>, drop its href, add data-href,
// inject the CSS as <style class="fcc-injected-styles">; `code` is all files concatenated in seed order.
const CSS_LINK = /<link\b[^>]*\bhref\s*=\s*["'](?:\.\/)?styles\.css["'][^>]*>/gi;
export function buildSource(files) {
  const html = files.find((f) => f.lang === 'html'), css = files.find((f) => f.lang === 'css');
  return (html?.contents ?? '').replace(CSS_LINK, (m) => {
    const href = m.match(/href\s*=\s*["']([^"']+)["']/i)[1].replace(/^\.\//, '');
    return m.replace(/\bhref\s*=\s*["'][^"']+["']/i, `data-href="${href}"`) + `<style class="fcc-injected-styles" data-href="${href}">${css?.contents ?? ''}</style>`;
  });
}
let loading;
const load = () => (loading ??= new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/curriculum-helpers/index.js'; s.onload = ok; s.onerror = () => no(new Error('test runner failed to load')); document.head.append(s); }));

// Measured: with every image request hanging forever the runner's frame still loads in well under a second, so remote images
// are NOT what makes it time out. What the frame does need is its own script from the local server (dom-test-evaluator.js),
// so a slow or paused server (Android can throttle Termux in the background, especially on battery saver) is the likelier
// cause. So: one attempt, then one patient retry, and say so on screen instead of looking frozen.
// The runner's test frame is sandboxed (no origin), so the service worker never sees its requests, and the runner would make
// the frame fetch its own script from the server — failing whenever the server is slow, paused or stopped (this is what
// "Timed out waiting for the test frame to load" was). The runner only ever writes that script as a <script src> tag into the
// frame's srcdoc, so while a runner is being created that one tag is swapped for the same file inline. Same script, same frame,
// same sandbox, same tests — it just no longer needs the network. (Blob and data URLs don't work: the runner forces assetPath
// to be a server path.) The bundle works out its own location from a <script src> in the page, so a placeholder script with an
// unknown type (never fetched, never run) carries that address.
let evaluator;
const loadEvaluator = () => (evaluator ??= fetch('vendor/curriculum-helpers/dom-test-evaluator.js').then((r) => { if (!r.ok) throw new Error('evaluator ' + r.status); return r.text(); })
  .then((t) => t.replace(/<\/script/gi, '<\\/script')).catch((e) => { evaluator = undefined; throw e; }));
const SCRIPT_TAG = /<script id='test-evaluator-script' src='[^']*'><\/script>/;
async function create(opts, timeout) {
  const text = await loadEvaluator();
  const orig = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
  Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', { ...orig, configurable: true,
    set(v) { orig.set.call(this, this.id === 'test-frame' ? String(v).replace(SCRIPT_TAG, () => `<script type='application/x-rvstez-placeholder' src='${location.origin}/vendor/curriculum-helpers/dom-test-evaluator.js'></script><script id='test-evaluator-script'>${text}</script>`) : v); } });
  try { return await window.FCCTestRunner.createTestRunner(opts, { timeout }); }
  finally { Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', orig); }
}
const DEADLINE_MS = 40000; // hard cap for one whole check, so the button can never stay busy indefinitely

// Returns one {pass, msg?} per test.
export async function runChecks({ files, tests, beforeEach, onStatus }) {
  const started = Date.now(); await load();
  const opts = { source: buildSource(files), type: 'dom', assetPath: '/vendor/curriculum-helpers/',
    code: { contents: files.map((f) => f.contents).join('\n'), editableContents: '' }, hooks: beforeEach ? { beforeEach } : undefined };
  let runner;
  try { runner = await create(opts, 10000); }
  catch { onStatus?.('The test frame is slow to start — trying again…'); runner = await create(opts, 25000); }
  const out = [];
  try {
    for (const t of tests) {
      const left = DEADLINE_MS - (Date.now() - started);
      if (left <= 0) { out.push({ pass: false, msg: 'This check ran out of time. Press Check again.' }); continue; }
      const r = await Promise.race([runner.runTest(t), new Promise((res) => setTimeout(() => res({ err: { message: 'Test timed out' } }), Math.min(8000, left)))]).catch((e) => ({ err: e }));
      out.push(r.pass ? { pass: true } : { pass: false, msg: String(r.err?.message ?? 'failed').slice(0, 300) });
    }
  } finally { try { runner.dispose(); } catch { /* already gone */ } }
  return out;
}
