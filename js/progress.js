// Pure functions: manifest + state -> position, next/previous, progress. No DOM, no storage.
// Manifest challenge tuples are [id, title, dashedName, challengeType].
// The certification exam is a stub in the source ("start in the exam environment app"), so it is
// navigable but never counted toward progress.

export function buildIndex(manifest) {
  const list = []; const byId = new Map(); const chapters = [];
  for (const ch of manifest.chapters) {
    const c = { name: ch.name, title: ch.title, chapterType: ch.chapterType, start: list.length, modules: [] };
    for (const mo of ch.modules) {
      const m = { name: mo.name, title: mo.title, moduleType: mo.moduleType, start: list.length, blocks: [] };
      for (const bl of mo.blocks) {
        const b = { name: bl.name, title: bl.title, kind: bl.kind, start: list.length };
        bl.challenges.forEach(([id, title, dashedName, type], index) => {
          const item = { id, title, dashedName, type, chapter: ch.name, module: mo.name, block: bl.name, kind: bl.kind, index, pos: list.length, counted: bl.kind !== 'exam' };
          list.push(item); byId.set(id, item);
        });
        b.end = list.length; m.blocks.push(b);
      }
      m.end = list.length; c.modules.push(m);
    }
    c.end = list.length; chapters.push(c);
  }
  return { list, byId, chapters };
}

export const nextOf = (idx, id) => idx.list[(idx.byId.get(id)?.pos ?? -2) + 1] ?? null;
export const prevOf = (idx, id) => idx.list[(idx.byId.get(id)?.pos ?? 1) - 1] ?? null;

export function tally(idx, state, start = 0, end = idx.list.length) {
  let done = 0, total = 0;
  for (let i = start; i < end; i++) { const c = idx.list[i]; if (!c.counted) continue; total++; if (c.id in state.completed) done++; }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// What the "Continue" button opens.
//  1. the challenge the learner was last on, if it is not finished
//  2. otherwise the next unfinished challenge after it (wrapping to the first unfinished one)
//  3. null when everything counted is finished
export function continueTarget(idx, state) {
  const firstOpen = (from) => {
    for (let i = from; i < idx.list.length; i++) if (idx.list[i].counted && !(idx.list[i].id in state.completed)) return idx.list[i];
    return null;
  };
  const here = state.position && idx.byId.get(state.position.id);
  if (!here) return firstOpen(0);
  if (here.counted && !(here.id in state.completed)) return here;
  return firstOpen(here.pos + 1) ?? firstOpen(0);
}

// A human location for the context header.
export function locate(idx, id) {
  const c = idx.byId.get(id); if (!c) return null;
  const ch = idx.chapters.find((x) => x.name === c.chapter);
  const mo = ch.modules.find((x) => x.name === c.module);
  const bl = mo.blocks.find((x) => x.name === c.block);
  return { challenge: c, chapter: ch, module: mo, block: bl, step: c.index + 1, of: bl.end - bl.start, prev: prevOf(idx, id), next: nextOf(idx, id) };
}
