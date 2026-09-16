import { useEffect, useState } from 'react';
import { apiRequest } from '../../../services/api';
import type { CollectionSummary } from '../types';

/**
 * How many questions a collection holds, or null if we cannot say.
 *
 * Null rather than 0 for an empty collection: every consumer uses this as a DENOMINATOR, and a
 * zero would turn "25% of the collection" into "always earned" for a room with nobody in it.
 */
export function questionCountForSlug(
  collections: CollectionSummary[], slug: string | null,
): number | null {
  if (!slug) return null;
  const found = collections.find(c => c.slug === slug);
  return found && found.questionCount > 0 ? found.questionCount : null;
}

/**
 * The collection's size, for the crowd's 25% milestone and the results screen's proficiency.
 *
 * The list is fetched on the dashboard by `useCollections`, but the game is a separate route
 * with its own component tree, so it has to ask again. One extra GET of an endpoint the app
 * already calls, on a public route, on a screen that is about to run for minutes.
 *
 * Never throws and never rejects outward: the crowd and the proficiency stat both degrade to
 * "unknown", and neither is worth interrupting a match for.
 */
export function useCollectionQuestionCount(slug: string | null): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) { setCount(null); return; }
    let cancelled = false;
    apiRequest<{ collections: CollectionSummary[] }>('/api/game/collections')
      .then(({ collections }) => {
        // A response that lands after the collection changed must not answer for the new one.
        if (!cancelled) setCount(questionCountForSlug(collections ?? [], slug));
      })
      .catch(() => { if (!cancelled) setCount(null); });
    return () => { cancelled = true; };
  }, [slug]);

  return count;
}
