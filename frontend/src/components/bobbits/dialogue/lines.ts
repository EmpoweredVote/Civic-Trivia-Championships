/**
 * Line selection, ported from empowered.vote's `ev-lines.js`.
 *
 * A speaker registers `beats` (named moments -- "wave", "point"). Each beat holds either an
 * ordered `lines` array, first-match-wins, or an unordered `pool`, drawn at random from
 * whatever fits. A line's `when` is an AND over context tags; a line with no `when` is the
 * fallback.
 *
 * The content itself lives in `copy.en.ts`. This file only decides which entry to use.
 *
 * NOT ported: `ev-quotes.js`. That module is the landing page's DOM bubble layer -- mounting
 * absolutely-positioned elements, measuring tails, placing them around a scrolling document.
 * CTC draws its bubbles inside the field canvas instead, and their lifetimes live in
 * `bubbleReducer.ts`, so there is nothing in that file left to carry over.
 */

export interface LineDef {
  /** Message id in the copy catalogue, an array to pick from, or null for a deliberate silence. */
  id: string | string[] | null;
  /** AND-ed context tags. Absent or empty means "always fits" -- the fallback. */
  when?: string[];
  /** CSS selector naming what the speaker points at while saying this. */
  aim?: string | null;
}

export interface Beat {
  at: string;
  lines?: LineDef[];
  pool?: LineDef[];
}

export interface SpeakerDef {
  beats: Beat[];
}

export interface Facts {
  now?: Date;
  loggedIn?: boolean;
  name?: string | null;
  returning?: boolean;
  [key: string]: unknown;
}

export interface LineContext extends Facts {
  finePointer: boolean;
  now: Date;
  hour: number;
  tags: string[];
}

export interface Resolved {
  /** The catalogue id chosen, or null for a deliberate silence. */
  id: string | null;
  /** False when nothing matched at all -- an authoring gap, not a deliberate silence. */
  matched: boolean;
  aim: string | null;
}

const finePointer = (() => {
  try { return !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches); }
  catch { return true; } // no matchMedia: assume a mouse, the older-browser case
})();

/**
 * Context tags. Each predicate names a condition a line can require. Keep them cheap and
 * total -- they run on every resolve.
 */
const PREDICATES: Record<string, (c: LineContext) => boolean> = {
  morning: c => c.hour >= 5 && c.hour < 12,
  afternoon: c => c.hour >= 12 && c.hour < 17,
  evening: c => c.hour >= 17 || c.hour < 5,
  touch: c => !c.finePointer,
  mouse: c => c.finePointer,
  loggedIn: c => !!c.loggedIn,
  anonymous: c => !c.loggedIn,
  returning: c => !!c.returning,
  firstVisit: c => !c.returning,
  named: c => !!c.name,
};

export function context(facts: Facts = {}): LineContext {
  const now = facts.now || new Date();
  const c: LineContext = {
    finePointer,
    loggedIn: false,
    name: null,
    returning: false,
    ...facts,
    now,
    hour: now.getHours(),
    tags: [],
  };
  c.tags = Object.keys(PREDICATES).filter(name => PREDICATES[name](c));
  return c;
}

const speakers: Record<string, SpeakerDef> = {};

/**
 * An id array's chosen index, held for the session. He must not change his mind between beats
 * or on a re-render -- but should vary between visits.
 */
const picks: Record<string, string | number> = {};

export function register(who: string, def: SpeakerDef) { speakers[who] = def; }

/** Test seam: forget every registered speaker and held pick. */
export function resetSpeakers() {
  for (const k of Object.keys(speakers)) delete speakers[k];
  for (const k of Object.keys(picks)) delete picks[k];
}

function beatOf(who: string, at: string): Beat | null {
  const def = speakers[who];
  if (!def || !def.beats) return null;
  return def.beats.find(b => b.at === at) || null;
}

/** `when` is an AND: every tag it names must be present. */
export function matches(line: LineDef, tags: string[]): boolean {
  if (!line.when || !line.when.length) return true; // no condition: the fallback
  return line.when.every(t => tags.includes(t));
}

function pickId(id: LineDef['id'], key: string): string | null {
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (!id.length) return null;
  if (!(key in picks)) picks[key] = Math.floor(Math.random() * id.length);
  return id[picks[key] as number];
}

/**
 * A pool is unordered: one of the entries that fits is drawn at random. Ordinary `lines` stay
 * first-match-wins, because priority is a deliberate authoring decision; a pool is for cases
 * where nothing outranks anything and the point is that a returning visitor gets a different
 * line.
 *
 * The draw is held for the page's lifetime, keyed by beat, and not for tidiness: resolve() can
 * be called again, and re-drawing would let the text and its pointing target disagree.
 */
function pickPool(members: LineDef[], tags: string[], key: string): LineDef | null {
  if (key in picks) return picks[key] as unknown as LineDef;
  const fit = members.filter(m => matches(m, tags));
  if (!fit.length) return null;
  const chosen = fit[Math.floor(Math.random() * fit.length)];
  picks[key] = chosen as unknown as string;
  return chosen;
}

export function resolve(who: string, at: string, facts: Facts = {}): Resolved {
  const c = context(facts);
  const beat = beatOf(who, at);
  if (!beat) return { id: null, matched: false, aim: null };

  const key = `${who}:${at}`;

  if (beat.pool) {
    const chosen = pickPool(beat.pool, c.tags, key);
    if (!chosen) return { id: null, matched: false, aim: null };
    return { id: pickId(chosen.id, `${key}:id`), matched: true, aim: chosen.aim ?? null };
  }

  for (const line of beat.lines || []) {
    if (!matches(line, c.tags)) continue;
    return { id: pickId(line.id, `${key}:id`), matched: true, aim: line.aim ?? null };
  }
  return { id: null, matched: false, aim: null };
}

/**
 * The one substitution the catalogue supports. A single named token, so a translator can move
 * it within the sentence -- Spanish and German both need to -- without this file having to
 * parse anything.
 */
export function fill(text: string, c: { name?: string | null }): string {
  if (!text) return text;
  return text.replace(/\{name\}/g, c.name || '');
}
