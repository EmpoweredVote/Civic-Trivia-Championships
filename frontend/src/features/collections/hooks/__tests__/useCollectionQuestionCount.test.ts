import { describe, it, expect } from 'vitest';
import { questionCountForSlug } from '../useCollectionQuestionCount';
import type { CollectionSummary } from '../../types';

const summary = (slug: string, questionCount: number): CollectionSummary => ({
  id: 1,
  name: slug,
  slug,
  description: '',
  themeColor: '#1E3A8A',
  questionCount,
  tier: 'city',
});

describe('questionCountForSlug', () => {
  it('finds the count for a slug', () => {
    expect(questionCountForSlug([summary('a', 10), summary('b', 42)], 'b')).toBe(42);
  });

  it('is null for a slug that is not there', () => {
    expect(questionCountForSlug([summary('a', 10)], 'zzz')).toBeNull();
  });

  it('is null with no slug at all', () => {
    expect(questionCountForSlug([summary('a', 10)], null)).toBeNull();
  });

  /**
   * A collection with no questions must not become a 0 denominator downstream. Every consumer
   * divides by this, and `treeEarned` would read 0 as "25% reached" for a room with nobody in
   * it.
   */
  it('is null rather than zero when the collection is empty', () => {
    expect(questionCountForSlug([summary('a', 0)], 'a')).toBeNull();
  });
});
