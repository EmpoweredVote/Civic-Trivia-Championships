# CTC database access — what broke, and what we need

**From:** Civic Trivia Championship (CTC) maintainers
**To:** Chris Andrews
**Date:** 2026-09-27
**Supabase project:** `kxsdzaojfaibhuzmclfq` (shared EV project)

Written to be read cold — no CTC context assumed.

---

## The ask, in one paragraph

CTC's dedicated Postgres role `ctc_app` can no longer log in, and its table grants on the
`trivia` schema are gone. We are not asking for it to be switched back on without thought —
from the outside it looks like a deliberate decommission, and if that was the intent we would
rather hear what should replace it. **What we need is a credential CTC's content tooling can
use, scoped to the `trivia` schema.** Right now we are borrowing `ev_api`, which works but is
another service's identity and is not a good place to stay.

---

## What broke

CTC's configured `DATABASE_URL` uses the role `ctc_app` through the Supavisor session pooler:

```
postgresql://ctc_app.kxsdzaojfaibhuzmclfq:***@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

Every connection fails, for `psql` and the application client alike:

```
FATAL:  (EAUTHQUERY) user not found in the database
```

and after a few attempts in quick succession, Supavisor starts refusing outright:

```
FATAL:  (ECIRCUITBREAKER) failed to retrieve database credentials after multiple attempts,
        new connections are temporarily blocked
```

**The error message is misleading.** The role has not been deleted. It is still in `pg_roles`.

---

## Root cause, measured

Queried through a working connection on 2026-09-27:

```sql
SELECT rolname, rolcanlogin, rolbypassrls, rolsuper FROM pg_roles
WHERE rolname IN ('ctc_app','ev_api');
```

| role | `rolcanlogin` | `rolbypassrls` | `rolsuper` |
|---|---|---|---|
| `ctc_app` | **false** | **true** | false |
| `ev_api` | true | true | false |

```sql
SELECT privilege_type, count(*) FROM information_schema.role_table_grants
WHERE grantee = 'ctc_app' AND table_schema = 'trivia' GROUP BY 1;
```

| role | grants on `trivia.*` (13 tables) |
|---|---|
| `ctc_app` | **none — zero rows** |
| `ev_api` | SELECT / INSERT / UPDATE / DELETE on all 13 |

So two separate things were done to `ctc_app`: **LOGIN was revoked**, and **its table grants
on `trivia` were revoked.** Supavisor cannot complete its credential lookup for a role that
cannot log in, which is where the "user not found" wording comes from.

Both changes together read as an intentional retirement of the role rather than an accident,
which is why this document asks what should replace it instead of asking for
`ALTER ROLE ctc_app LOGIN`.

One loose end worth noting either way: **`ctc_app` still has `BYPASSRLS`** despite having no
login and no grants. A dormant role carrying that attribute is worth cleaning up.

---

## What CTC actually needs — probably less than you would expect

Worth stating plainly, because it should shrink the decision:

- **The CTC backend service is suspended.** Render service `srv-d69ubnk9c44c738h8fh0`
  (`civic-trivia-backend`) serves no traffic, with auto-deploy off.
- **Production CTC is served by ev-accounts** at `https://api.empowered.vote`, which already
  connects as `ev_api`. That path is healthy and is not affected by any of this.
- **The only thing still needing `ctc_app` is local content tooling** in the CTC repo —
  scripts that create collections, generate and audit trivia questions, and run quality
  checks over the question bank. They read and write `trivia.*` and nothing else.

So the requirement is: **one role, LOGIN, USAGE on `trivia` plus `extensions`, and
SELECT/INSERT/UPDATE/DELETE on the 13 `trivia` tables.**

`extensions` matters and is easy to miss: `pg_trgm` lives in the `extensions` schema rather
than on the search path, and the duplicate-detection code calls
`extensions.similarity(...)` explicitly. `ctc_app` never had USAGE there, which we suspect
was already a latent bug.

### On BYPASSRLS

All 13 `trivia` tables have row-level security enabled. The old `ctc_app` had `BYPASSRLS` and
so does `ev_api`. **We do not know whether CTC's tooling actually needs it**, and we would
rather not ask for it by default. If the existing policies let a service role read and write
`trivia.*`, a replacement role without `BYPASSRLS` is the better shape and we are happy to
test that and report back.

---

## What we are doing in the meantime, and why it should not last

CTC tooling is currently connecting with the `DATABASE_URL` from **ev-accounts**, role
`ev_api`. It works and it sees the same data. Three reasons it is a stopgap:

1. **Blast radius.** `ev_api` is scoped to everything ev-accounts needs, which is more than
   CTC needs. A mistake in a CTC content script can reach further than CTC.
2. **Attribution.** Anything CTC writes is recorded as `ev_api`. If you are looking at
   database activity to work out who changed what, CTC's writes are hiding inside another
   service's identity.
3. **Credential spread.** It means a second copy of ev-accounts' credential in a second
   developer's environment, which is the thing the original per-service roles existed to
   avoid.

We will keep using it only until there is a replacement, and we would rather that be short.

---

## Security notes, while you are in here

Not blockers, but they surfaced while diagnosing this and you should have them:

- **`ctc_app` retains `BYPASSRLS`** with no login and no grants. Drop the role or strip the
  attribute.
- **The `ctc_app` password is in plaintext in at least two places** — a local `.env` and an
  AI assistant's persisted memory file. If the role is ever revived, rotate it first and do
  not reuse the old value. If it is dropped, that is moot, which is another argument for
  dropping it.
- **CTC's `.env` still carries the legacy Supabase `anon` and `service_role` keys.** Those
  were disabled project-wide on 2026-09-09 — the REST API now answers
  *"Legacy API keys (anon, service_role) were disabled"* — so they are dead credentials
  sitting in a file. They should be removed rather than left to rot. CTC has no current need
  for a REST key; if it ever does, it would need a new-style publishable/secret key **and**
  the `trivia` schema exposed, which it currently is not (exposed schemas are `public`,
  `civic_spaces`, `connect`, `empower`, `inform`, `graphql_public`, `validation_quests`,
  `treasury`, `civic`).
- **This repo is behind.** Its `backend/` is frozen — the canonical trivia backend now lives
  in `ev-accounts/backend/src/trivia/`. Some of what is configured here reflects an older
  arrangement, so please treat CTC's stored configuration as suspect rather than as evidence
  of what is supposed to be true.

---

## Expected behaviour

What "fixed" looks like from our side:

1. A role exists that CTC tooling can log in as through
   `aws-0-us-west-1.pooler.supabase.com:5432` (**region matters** — `us-east-1` routes to the
   wrong Supavisor cluster and fails even for valid roles).
2. It can `SELECT`, `INSERT`, `UPDATE`, `DELETE` on all 13 tables in `trivia`, and has
   `USAGE` on `trivia` and `extensions`.
3. It needs nothing outside the `trivia` schema.
4. Its password does not rotate on its own. The original reason `ctc_app` was created, back
   in June, was that the `postgres` superuser password rotates without warning and kept
   taking the service down.
5. We are told which role it is, so we can set it and stop borrowing `ev_api`.

If the answer is "CTC should not have its own database role any more, route through
ev-accounts", that is a fine answer — it just needs saying, because the content tooling then
needs a different design and we would rather plan that than keep improvising.

---

## Reproducing it

```bash
# Fails — the configured CTC credential
psql "postgresql://ctc_app.kxsdzaojfaibhuzmclfq:<pw>@aws-0-us-west-1.pooler.supabase.com:5432/postgres" \
  -c "select 1;"
# FATAL:  (EAUTHQUERY) user not found in the database

# Confirms the role exists but cannot log in
psql "$WORKING_URL" -c \
  "SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname = 'ctc_app';"
# ctc_app | f | t

# Confirms the grants are gone
psql "$WORKING_URL" -c \
  "SELECT count(*) FROM information_schema.role_table_grants
   WHERE grantee='ctc_app' AND table_schema='trivia';"
# 0
```

If the circuit breaker has tripped from repeated attempts, wait a minute before retrying —
`ECIRCUITBREAKER` is Supavisor rate-limiting the failures, not a separate fault.

---

## Contact

Reply to Chris (CTC). Happy to test any replacement role and confirm the content scripts run
clean against it, including whether it works without `BYPASSRLS`.
