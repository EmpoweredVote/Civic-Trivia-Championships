import { describe, it, expect } from 'vitest';
import { CIVIC_FACTS, sessionFact } from '../civicFacts';

describe('sessionFact', () => {
  it('returns one of the pool', () => {
    expect(CIVIC_FACTS).toContain(sessionFact());
  });

  it('returns the same fact on every call within a session', () => {
    const first = sessionFact();
    for (let i = 0; i < 50; i++) expect(sessionFact()).toBe(first);
  });

  it('has a pool worth shuffling', () => {
    expect(CIVIC_FACTS.length).toBeGreaterThan(1);
  });
});
