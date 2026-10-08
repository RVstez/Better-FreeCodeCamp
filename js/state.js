// Learner state. Curriculum content is never stored here — only what the learner did.
//
// Two localStorage keys, so frequent small writes (navigation) never rewrite large code blobs:
//   rvstez-rwd-state : { v, position, completed, attempts, quizAttempts, settings }   (small)
//   rvstez-rwd-code  : { v, code: { [challengeId]: { files, at } } }                  (can be larger)
//
// Failure model: every storage call is guarded. If storage is unavailable, full, or the data is unreadable,
// the app keeps working from memory and `status` tells the UI what happened. Unreadable data is never overwritten
// without a backup, and data written by a NEWER app version is never modified.

export const VERSION = 1;
export const KEY = 'rvstez-rwd-state';
export const CODE_KEY = 'rvstez-rwd-code';
export const EXPORT_FORMAT = 'rvstez-rwd-export';
const MAX_QUIZ_ATTEMPTS = 20;
const MAX_FILE_CHARS = 200_000;

// migrations[n] upgrades a version-n object to version n+1 (applies to both keys' payloads).
export const MIGRATIONS = {};

const fresh = () => ({ v: VERSION, position: null, completed: {}, attempts: {}, quizAttempts: {}, settings: {} });
const freshCode = () => ({ v: VERSION, code: {} });

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const safeKey = (k) => typeof k === 'string' && k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
const num = (x) => typeof x === 'number' && Number.isFinite(x);

function cleanMap(src, valid) {
  const out = {};
  if (!isObj(src)) return out;
  for (const [k, v] of Object.entries(src)) if (safeKey(k) && valid(v)) out[k] = v;
  return out;
}
function cleanAttempt(a) {
  return isObj(a) && num(a.n) && num(a.at) && Array.isArray(a.passed) && typeof a.ok === 'boolean';
}
function cleanQuiz(list) {
  return Array.isArray(list) && list.every((q) => isObj(q) && num(q.at) && num(q.score) && num(q.of) && typeof q.passed === 'boolean');
}
// Coerces anything into a valid state object, dropping entries of the wrong shape.
export function sanitizeState(x) {
  const s = fresh();
  if (!isObj(x)) return s;
  if (isObj(x.position) && typeof x.position.id === 'string' && num(x.position.at)) s.position = { id: x.position.id, at: x.position.at };
  s.completed = cleanMap(x.completed, num);
  s.attempts = cleanMap(x.attempts, cleanAttempt);
  s.quizAttempts = cleanMap(x.quizAttempts, cleanQuiz);
  s.settings = isObj(x.settings) ? { ...x.settings } : {};
  return s;
}
export function sanitizeCode(x) {
  const c = freshCode();
  const entry = (e) => isObj(e) && num(e.at) && isObj(e.files) && Object.values(e.files).every((t) => typeof t === 'string');
  if (isObj(x)) c.code = cleanMap(x.code, entry);
  return c;
}

function migrate(obj, migrations, target) {
  let v = obj.v;
  while (v < target) {
    const step = migrations[v];
    if (!step) throw new Error(`no migration from v${v}`);
    obj = { ...step(obj), v: v + 1 }; v++;
  }
  return obj;
}

// `version` defaults to the current schema version; tests pass a higher one to exercise migrations.
export function createStore({ storage = globalThis.localStorage, now = Date.now, migrations = MIGRATIONS, keepCodeAfterComplete = () => true, version = VERSION } = {}) {
  const F = () => ({ ...fresh(), v: version }), FC = () => ({ ...freshCode(), v: version });
  const S = (x) => ({ ...sanitizeState(x), v: version }), SC = (x) => ({ ...sanitizeCode(x), v: version });
  const status = { ok: true, readOnly: false, recovered: null, error: null };
  const listeners = new Set();
  let state = F(), code = FC();
  const dirty = { core: false, code: false };

  const fail = (e) => { status.ok = false; status.error = String(e?.message ?? e); };
  const read = (key) => { try { return storage.getItem(key); } catch (e) { fail(e); return null; } };
  const write = (key, text) => { try { storage.setItem(key, text); return true; } catch (e) { fail(e); return false; } };

  // Returns {data, migrated} or null when the stored value is absent; throws on corruption.
  function load(key, sanitize) {
    const raw = read(key);
    if (raw == null) return null;
    let obj;
    try { obj = JSON.parse(raw); } catch { obj = undefined; }
    if (!isObj(obj) || !Number.isInteger(obj.v) || obj.v < 1) {
      write(`${key}.corrupt`, raw); // keep the unreadable original so nothing is lost silently
      status.recovered = 'corrupt';
      return null;
    }
    if (obj.v > version) { status.readOnly = true; status.recovered = 'future'; return { data: sanitize(obj), migrated: false }; }
    if (obj.v < version) {
      try { obj = migrate(obj, migrations, version); } catch (e) { write(`${key}.v${obj.v}.bak`, raw); status.recovered = 'migration-failed'; fail(e); return null; }
      return { data: sanitize(obj), migrated: true };
    }
    return { data: sanitize(obj), migrated: false };
  }

  const a = load(KEY, S); if (a) { state = a.data; if (a.migrated) { dirty.core = true; status.recovered ??= 'migrated'; } }
  const b = load(CODE_KEY, SC); if (b) { code = b.data; if (b.migrated) { dirty.code = true; status.recovered ??= 'migrated'; } }

  function flush() {
    if (status.readOnly) return false;
    let ok = true;
    if (dirty.core) { if (write(KEY, JSON.stringify(state))) dirty.core = false; else ok = false; }
    if (dirty.code) { if (write(CODE_KEY, JSON.stringify(code))) dirty.code = false; else ok = false; }
    if (ok) { status.ok = true; status.error = null; }
    return ok;
  }
  const commit = (parts) => { for (const p of parts) dirty[p] = true; const ok = flush(); for (const fn of listeners) fn(); return ok; };
  if (dirty.core || dirty.code) flush();

  const store = {
    status,
    get: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    isDone: (id) => id in state.completed,

    visit(id) { state.position = { id, at: now() }; return commit(['core']); },

    complete(id) {
      if (!(id in state.completed)) state.completed[id] = now();
      const parts = ['core'];
      if (id in code.code && !keepCodeAfterComplete(id)) { delete code.code[id]; parts.push('code'); }
      return commit(parts);
    },
    resetChallenge(id) {
      delete state.completed[id]; delete state.attempts[id]; delete state.quizAttempts[id];
      const parts = ['core']; if (id in code.code) { delete code.code[id]; parts.push('code'); }
      return commit(parts);
    },

    // results: array of booleans or {pass:boolean}. Only per-test pass flags are kept (messages are re-derivable by re-running).
    recordCheck(id, results) {
      const passed = results.map((r) => !!(typeof r === 'object' ? r.pass : r));
      const ok = passed.length > 0 && passed.every(Boolean);
      const prev = state.attempts[id];
      state.attempts[id] = { n: (prev?.n ?? 0) + 1, at: now(), passed, ok };
      if (ok) store.complete(id); else commit(['core']);
      return { allPassed: ok };
    },
    recordQuiz(id, { score, of, passed }) {
      const list = (state.quizAttempts[id] ??= []);
      list.push({ at: now(), score, of, passed: !!passed });
      if (list.length > MAX_QUIZ_ATTEMPTS) list.splice(0, list.length - MAX_QUIZ_ATTEMPTS);
      if (passed) store.complete(id); else commit(['core']);
    },

    saveCode(id, files) {
      const clean = {};
      for (const [name, text] of Object.entries(files)) if (typeof text === 'string') clean[name] = text.slice(0, MAX_FILE_CHARS);
      code.code[id] = { files: clean, at: now() };
      return commit(['code']);
    },
    getCode: (id) => code.code[id]?.files ?? null,

    setSetting(k, v) { state.settings[k] = v; return commit(['core']); },

    export() {
      return JSON.stringify({ format: EXPORT_FORMAT, version, exportedAt: now(), state, code });
    },
    // merge=true keeps what is already here (union of completions, newer attempt/code wins); merge=false replaces everything.
    import(text, { merge = true } = {}) {
      if (status.readOnly) throw new Error('storage was written by a newer app version; import is disabled');
      let doc; try { doc = JSON.parse(text); } catch { throw new Error('not valid JSON'); }
      if (!isObj(doc) || doc.format !== EXPORT_FORMAT || !Number.isInteger(doc.version)) throw new Error('not a Better-FreeCodeCamp export');
      if (doc.version > version) throw new Error(`export is from a newer app version (v${doc.version})`);
      const inState = S(doc.version < version ? migrate({ ...doc.state, v: doc.version }, migrations, version) : doc.state);
      const inCode = SC(doc.version < version ? migrate({ ...doc.code, v: doc.version }, migrations, version) : doc.code);
      const summary = { completed: 0, attempts: 0, code: 0 };
      if (!merge) { state = inState; code = inCode; }
      else {
        for (const [id, at] of Object.entries(inState.completed)) { if (!(id in state.completed)) summary.completed++; state.completed[id] = Math.min(at, state.completed[id] ?? at); }
        for (const [id, at] of Object.entries(inState.attempts)) if (!(id in state.attempts) || at.at > state.attempts[id].at) { state.attempts[id] = at; summary.attempts++; }
        for (const [id, list] of Object.entries(inState.quizAttempts)) {
          const seen = new Set((state.quizAttempts[id] ?? []).map((q) => q.at));
          state.quizAttempts[id] = [...(state.quizAttempts[id] ?? []), ...list.filter((q) => !seen.has(q.at))].sort((x, y) => x.at - y.at).slice(-MAX_QUIZ_ATTEMPTS);
        }
        for (const [id, e] of Object.entries(inCode.code)) if (!(id in code.code) || e.at > code.code[id].at) { code.code[id] = e; summary.code++; }
        if (inState.position && (!state.position || inState.position.at > state.position.at)) state.position = inState.position;
        state.settings = { ...state.settings, ...inState.settings };
      }
      commit(['core', 'code']);
      return summary;
    },
    // Removes learner data only (and any recovery backups); never touches other keys.
    reset() {
      if (status.readOnly) throw new Error('storage was written by a newer app version; reset is disabled');
      state = F(); code = FC(); dirty.core = dirty.code = false;
      for (const k of [KEY, CODE_KEY, `${KEY}.corrupt`, `${CODE_KEY}.corrupt`]) { try { storage.removeItem(k); } catch (e) { fail(e); } }
      status.recovered = null; for (const fn of listeners) fn();
    },
  };
  return store;
}
