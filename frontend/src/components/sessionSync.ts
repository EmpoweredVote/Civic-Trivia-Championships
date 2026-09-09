/**
 * Decision logic for the cross-app logout-sync poll (see AuthInitializer).
 *
 * The poll hits the accounts API's cookie-based `GET /api/auth/session` to
 * detect when a shared `ev_session` cookie is cleared by another EV app. The
 * problem: a Civic-Trivia login authenticates with a Bearer token and does not
 * establish that shared cookie at the accounts API host, so the poll returns
 * 401 for a perfectly valid CTC session. The old logic called clearAuth() on
 * any 401, which logged those users out every 60 seconds.
 *
 * Fix: only a *transition* from a seen cookie session (HTTP 2xx) to 401 means
 * the shared session was actually cleared elsewhere. A 401 with no prior 2xx
 * means this client never had a shared-cookie session (the Bearer-only CTC
 * case) and must NOT be logged out.
 *
 * `hadCookieSession` is true once the poll has observed a 2xx from the endpoint
 * during this session. Returns true only when the caller should clear auth.
 */
export function shouldClearOnSessionPoll(
  hadCookieSession: boolean,
  status: number
): boolean {
  return status === 401 && hadCookieSession;
}
