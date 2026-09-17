/**
 * The best number of bobits a player has ever held in a collection.
 *
 * Separate from `bobitProgress` on purpose. That key's shape is
 * `{ [slug]: { [questionId]: epochMs } }` and widening it would break its parse for every
 * player mid-collection, for a value that is not progress at all -- it is a latch on a piece of
 * scenery.
 *
 * Local even for signed-in players. The high-water mark is cosmetic, the signed-in driver reads
 * from ev-accounts, and that service is outside this repo while `backend/` here is frozen -- so
 * there is nowhere to put it server-side without work this plan cannot do. A signed-in player
 * who switches browsers re-earns the tree. That is worse than storing it properly and much
 * better than blocking the feature on another service.
 */

export const PEAK_STORAGE_KEY = 'ctc.bobits.peak.v1';

/** `{ [collectionSlug]: bestOwnedCountEverSeen }` */
type PeakShape = Record<string, number>;

export interface PeakStore {
  peak(slug: string): number;
  record(slug: string, owned: number): void;
}

export function createPeakStore(storage?: Storage): PeakStore {
  const backing = storage ?? safeDefaultStorage();

  // Filled on first USE. See the same note in bobitProgress.ts: a module-level singleton that
  // reads storage in its constructor has really read it at import time, and import order is not
  // something its callers can see or control.
  let mirror: PeakShape | null = null;
  const data = (): PeakShape => (mirror ??= read(backing));

  function read(s: Storage | null): PeakShape {
    if (!s) return {};
    try {
      const raw = s.getItem(PEAK_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      // Filtered rather than trusted: this is a latch on a visible piece of scenery, and a
      // string or a negative in here would otherwise compare against 25% and win.
      const out: PeakShape = {};
      for (const [slug, n] of Object.entries(parsed)) {
        if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[slug] = Math.floor(n);
      }
      return out;
    } catch {
      return {};   // corrupt or unreadable: start fresh rather than break the room
    }
  }

  function write() {
    if (!backing) return;
    try {
      backing.setItem(PEAK_STORAGE_KEY, JSON.stringify(data()));
    } catch {
      // Quota or private mode. The mirror already has it; only persistence is lost, and the
      // worst case is a tree re-earned next session.
    }
  }

  return {
    peak(slug) {
      return data()[slug] ?? 0;
    },
    record(slug, owned) {
      if (!Number.isFinite(owned) || owned <= 0) return;
      const d = data();
      const next = Math.floor(owned);
      if (next <= (d[slug] ?? 0)) return;
      d[slug] = next;
      write();
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
