import { describe, it, expect } from 'vitest';
import { isFeatured, sortFeaturedFirst } from '../featuredOrder';
import type { CollectionSummary } from '../types';

/**
 * The shelf itself cannot be component-tested here: no DOM-capable component tests exist,
 * by design — vitest is node-only in this repo. So the ordering rule and the undefined
 * handling are pulled out as pure functions and tested directly, and the rendered shelf
 * gets a deliberate read plus a real page load (`npm run smoke`) instead.
 */
function c(
  id: number,
  name: string,
  tier: CollectionSummary['tier'],
  featured?: boolean,
): CollectionSummary {
  return {
    id, name, slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: '', themeColor: '#000000', questionCount: 50, tier,
    ...(featured === undefined ? {} : { featured }),
  };
}

describe('isFeatured', () => {
  it('is true only for an explicit true', () => {
    expect(isFeatured(c(1, 'A', 'city', true))).toBe(true);
    expect(isFeatured(c(2, 'B', 'city', false))).toBe(false);
  });

  it('treats a MISSING field as not featured', () => {
    // This is the deploy-order guard. The API omits `featured` entirely until the backend
    // carrying migration 1883 ships, and the two deploy independently. An empty shelf is
    // the correct behaviour in that window — never a shelf rendered against undefined.
    const undecided = c(3, 'C', 'international');
    expect(undecided.featured).toBeUndefined();
    expect(isFeatured(undecided)).toBe(false);
  });
});

describe('sortFeaturedFirst', () => {
  it('lifts featured collections above every tier', () => {
    // `international` sorts LAST by tier, which is exactly why the events collections could
    // never reach the Dashboard's capped teaser before the flag existed.
    const items = [
      c(1, 'Austin', 'city'),
      c(2, 'Texas', 'state'),
      c(3, 'US Civics', 'federal'),
      c(4, 'World News', 'international', true),
    ];
    expect(sortFeaturedFirst(items).map(x => x.name)).toEqual([
      'World News', 'Austin', 'Texas', 'US Civics',
    ]);
  });

  it('survives the cap that used to bury them', () => {
    const cities = Array.from({ length: 12 }, (_, i) =>
      c(100 + i, `City ${String(i).padStart(2, '0')}`, 'city'),
    );
    const featured = c(1, 'War in Iran', 'international', true);
    const top10 = sortFeaturedFirst([...cities, featured]).slice(0, 10);
    expect(top10[0].name).toBe('War in Iran');
    expect(top10).toHaveLength(10);
  });

  it('orders featured collections among themselves by tier then name', () => {
    const items = [
      c(1, 'World News', 'international', true),
      c(2, 'US News', 'federal', true),
      c(3, 'Climate Change', 'international', true),
    ];
    expect(sortFeaturedFirst(items).map(x => x.name)).toEqual([
      'US News', 'Climate Change', 'World News',
    ]);
  });

  it('falls back to plain tier-then-name when nothing is featured', () => {
    const items = [c(1, 'Texas', 'state'), c(2, 'Austin', 'city'), c(3, 'Dallas', 'city')];
    expect(sortFeaturedFirst(items).map(x => x.name)).toEqual(['Austin', 'Dallas', 'Texas']);
  });

  it('does not mutate its input', () => {
    const items = [c(1, 'Austin', 'city'), c(2, 'World News', 'international', true)];
    const before = items.map(x => x.name);
    sortFeaturedFirst(items);
    expect(items.map(x => x.name)).toEqual(before);
  });
});
