import { describe, it, expect } from 'vitest';
import { rejectedNote } from '../generationResult';

/**
 * WHY THIS EXISTS
 * ---------------
 * `questionsRejected` counts questions the generator's schema refused (ev-accounts #993).
 * This sentence is appended to a toast and shown in the generation dialog, and each case
 * below is a way to put something wrong in front of an admin:
 *
 *   - a backend older than #993 does not send the field, and "undefined more were refused"
 *     is worse than saying nothing at all;
 *   - zero is the EXPECTED value, so a standing "0 more were refused" trains people to skim
 *     past the one line that matters on the day it is not zero;
 *   - "1 more were refused" is the sort of thing nobody fixes once it has shipped.
 *
 * The dialog itself is not covered. This repo's vitest lane is node-only by design, so no
 * test here renders a component — which is exactly why this sentence is built outside one.
 */
describe('rejectedNote', () => {
  it('says nothing when the backend does not send the field', () => {
    expect(rejectedNote(undefined)).toBe('');
  });

  it('says nothing at zero, which is the expected value', () => {
    expect(rejectedNote(0)).toBe('');
  });

  it('is singular for one', () => {
    expect(rejectedNote(1)).toBe(' 1 more was refused by the schema and not written.');
  });

  it('is plural for more than one', () => {
    expect(rejectedNote(3)).toBe(' 3 more were refused by the schema and not written.');
  });

  it('leads with a space, because it is appended to a finished sentence', () => {
    expect(rejectedNote(2).startsWith(' ')).toBe(true);
  });
});
