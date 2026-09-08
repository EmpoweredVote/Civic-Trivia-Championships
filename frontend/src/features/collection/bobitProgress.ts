import { apiRequest } from '../../services/api';

/**
 * Which questions a player has a bobit for.
 *
 * Synchronous on purpose. localStorage is synchronous, and the crowd choreography reads
 * owned-state inside a per-frame callback where a Promise would be useless. When the server
 * driver lands (in ev-accounts -- this repo's backend/ is frozen) it keeps this shape and
 * writes through asynchronously behind an in-memory mirror.
 */
export interface BobitProgressStore {
  load(slug: string): Set<string>;
  grant(slug: string, questionId: string): void;
  revoke(slug: string, questionId: string): void;
  /** Owned count per collection slug, for a future per-collection tally. */
  summary(): Record<string, number>;
  /**
   * Fill the mirror from wherever the truth lives, before the crowd is seeded.
   *
   * Optional, and absent on the localStorage driver -- there the mirror IS the truth and is
   * already populated by the time the store is constructed. Callers do `await
   * store.hydrate?.(slug)`, which is a no-op for signed-out play.
   */
  hydrate?(slug: string): Promise<void>;
}

export const STORAGE_KEY = 'ctc.bobits.v1';

/** `{ [collectionSlug]: { [questionExternalId]: epochMs } }` */
type Shape = Record<string, Record<string, number>>;

/**
 * Keyed by collection SLUG rather than the numeric collection id: the frontend's GameState
 * carries `collectionSlug` and never carries the id. Slug is notNull().unique() in the schema,
 * so it is just as stable -- and, importantly, it is still not derived from the question's
 * external-id prefix, which is the thing that cannot be trusted (the convention is 5 letters
 * now, legacy collections kept 3, and Indiana has two).
 */
export function createLocalProgressStore(storage?: Storage): BobitProgressStore {
  const backing = storage ?? safeDefaultStorage();

  // The in-memory mirror is the source of truth for reads. It means a storage that throws --
  // private mode, a full quota -- costs persistence but never costs the player their match.
  const data: Shape = read(backing);

  function read(s: Storage | null): Shape {
    if (!s) return {};
    try {
      const raw = s.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Shape) : {};
    } catch {
      return {};   // corrupt or unreadable: start fresh rather than break the game
    }
  }

  function write() {
    if (!backing) return;
    try {
      backing.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota or private mode. The mirror already has the change; persistence is what is lost.
    }
  }

  return {
    load(slug) {
      return new Set(Object.keys(data[slug] ?? {}));
    },
    grant(slug, questionId) {
      if (!data[slug]) data[slug] = {};
      if (data[slug][questionId] === undefined) {
        data[slug][questionId] = Date.now();
        write();
      }
    },
    revoke(slug, questionId) {
      if (data[slug]?.[questionId] === undefined) return;
      delete data[slug][questionId];
      write();
    },
    summary() {
      const out: Record<string, number> = {};
      for (const slug of Object.keys(data)) {
        const n = Object.keys(data[slug]).length;
        if (n > 0) out[slug] = n;
      }
      return out;
    },
  };
}

/** window.localStorage, or null where merely touching it throws. */
function safeDefaultStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}


/** Shape of `GET /api/users/profile/bobits`: collection slug -> owned question external ids. */
export type BobitsPayload = Record<string, string[]>;

/**
 * Per-account progress, for a signed-in player.
 *
 * **Read-server, write-local.** `hydrate` pulls the truth in one authenticated request;
 * `grant` and `revoke` then only touch the in-memory mirror, because the very answer
 * submission that triggered them has already told the server. That is what removes the whole
 * class of optimistic-write reconciliation bugs -- there is nothing to reconcile, because
 * this driver never writes.
 *
 * The trade is that a grant whose answer POST failed shows a bobit this match and loses him
 * on the next hydrate. Self-healing, and strictly better than blocking an answer on a
 * cosmetic write.
 */
export function createServerProgressStore(
  fetchBobits: () => Promise<BobitsPayload> = defaultFetchBobits,
): BobitProgressStore {
  let data: BobitsPayload = {};

  return {
    async hydrate() {
      try {
        const fetched = await fetchBobits();
        // Replaces rather than merges: the server is authoritative, so a bobit missing from
        // the payload is one the player genuinely no longer owns.
        data = fetched && typeof fetched === 'object' ? fetched : {};
      } catch {
        // Gameplay never blocks on the crowd. An empty field is the correct degradation.
        data = {};
      }
    },
    load(slug) {
      return new Set(data[slug] ?? []);
    },
    grant(slug, questionId) {
      const owned = data[slug] ?? (data[slug] = []);
      if (!owned.includes(questionId)) owned.push(questionId);
    },
    revoke(slug, questionId) {
      const owned = data[slug];
      if (!owned) return;
      const at = owned.indexOf(questionId);
      if (at >= 0) owned.splice(at, 1);
    },
    summary() {
      const out: Record<string, number> = {};
      for (const slug of Object.keys(data)) {
        if (data[slug].length > 0) out[slug] = data[slug].length;
      }
      return out;
    },
  };
}

/** The real request. `apiRequest` already attaches the Bearer token from the auth store. */
async function defaultFetchBobits(): Promise<BobitsPayload> {
  // /api/users/profile/... , not /api/profile/... -- the profile router is mounted at
  // /ctc/api/users/profile (see ev-accounts src/index.ts). The shorter path 404s silently,
  // which degrades to an empty crowd and looks exactly like every player losing their bobits.
  const { bobits } = await apiRequest<{ bobits: BobitsPayload }>('/api/users/profile/bobits', {
    method: 'GET',
  });
  return bobits ?? {};
}
