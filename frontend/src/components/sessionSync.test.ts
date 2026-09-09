import { describe, it, expect } from 'vitest';
import { shouldClearOnSessionPoll } from './sessionSync';

describe('shouldClearOnSessionPoll', () => {
  it('does NOT clear on 401 when no cookie session was ever seen (Bearer-only CTC login)', () => {
    // This is the bug being fixed: CTC Bearer logins get 401 from the cookie
    // endpoint forever and must not be logged out.
    expect(shouldClearOnSessionPoll(false, 401)).toBe(false);
  });

  it('clears on 401 after a cookie session was seen (logged out in another app)', () => {
    expect(shouldClearOnSessionPoll(true, 401)).toBe(true);
  });

  it('does not clear on a healthy 200', () => {
    expect(shouldClearOnSessionPoll(false, 200)).toBe(false);
    expect(shouldClearOnSessionPoll(true, 200)).toBe(false);
  });

  it('does not clear on other/transient statuses', () => {
    for (const status of [204, 403, 429, 500, 502, 503]) {
      expect(shouldClearOnSessionPoll(false, status)).toBe(false);
      expect(shouldClearOnSessionPoll(true, status)).toBe(false);
    }
  });
});
