/**
 * Ordering rules for the collection picker, kept free of React and DOM.
 *
 * They live here rather than in `CollectionPicker.tsx` so they can be unit tested: this
 * repo's vitest is node-only by design, and importing the component pulls in the theme
 * store, which reads `localStorage` at module scope and throws under node.
 */
import type { CollectionSummary } from './types';

export const TIER_ORDER: Record<string, number> = {
  city: 0, state: 1, federal: 2, international: 3,
};

export function sortByTierThenName(collections: CollectionSummary[]): CollectionSummary[] {
  return [...collections].sort((a, b) => {
    const tierDiff = (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99);
    if (tierDiff !== 0) return tierDiff;
    return a.name.localeCompare(b.name);
  });
}

/**
 * The shelf's single source of truth.
 *
 * Strict `=== true` because `featured` is optional: the API omits it entirely until the
 * backend carrying migration 1883 is deployed, and the two deploy independently. A missing
 * field means "not featured", so the shelf is empty rather than broken during that window.
 */
export function isFeatured(c: CollectionSummary): boolean {
  return c.featured === true;
}

/**
 * Featured first, then the ordinary tier-then-name order.
 *
 * This is what actually answers the Dashboard's promise. The teaser grid is capped at
 * `previewLimit` and `international` sorts LAST in TIER_ORDER, so before this the events
 * collections the strip is named for could never reach it — the cap filled with cities long
 * before the sort got to them.
 */
export function sortFeaturedFirst(collections: CollectionSummary[]): CollectionSummary[] {
  return [...collections].sort((a, b) => {
    const featuredDiff = Number(isFeatured(b)) - Number(isFeatured(a));
    if (featuredDiff !== 0) return featuredDiff;
    const tierDiff = (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99);
    if (tierDiff !== 0) return tierDiff;
    return a.name.localeCompare(b.name);
  });
}
