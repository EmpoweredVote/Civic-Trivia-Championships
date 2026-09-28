# HANDOFF — Collection Quality Audit (updated 2026-09-28, session 8)

**Resume with:** `/gsd:resume-work` or just point a session at this file.

- **Branch from `master`.** `feat/collection-quality-audit` is MERGED — do not resume on it.
  Each collection now gets its own short-lived `docs/<slug>-audit` branch off master.
- Worktree in use: `C:/ctc-quality-audit` (any clean worktree works; see the DB note below).
- Spec: `docs/superpowers/specs/2026-09-26-collection-quality-audit-design.md`
- Plan: `docs/superpowers/plans/2026-09-26-collection-quality-audit.md`
- **29 of 43 collections audited.** 800 archived across all sessions, 254 written.
  All archives reversible by `external_id` — nothing was ever `DELETE`d.
  Session 8 audited **los-angeles-ca** (collection 3) — the largest archive proportionally
  yet (48 of 73, 66%) and the first collection found carrying **another tier's content**.
- **DB access — SUPERSEDED as of session 6. Use `psql`, not MCP.**

      set -a; . /c/EV-Accounts/backend/.env; set +a
      psql "$DATABASE_URL" -At -F' | ' -c "SELECT ..."

  ev-accounts' `DATABASE_URL` (role `ev_api`) reaches the same `trivia` schema and works
  today. Sessions 3–5 were told to route everything through the Supabase MCP server because
  no local checkout could authenticate; that advice is now expensive and should not be
  followed. **MCP costs roughly 10k tokens per 300 rows and cannot write to a file; `psql`
  costs nothing and can.** Session 6 dumped all 854 source URLs to disk this way, which is
  not practical through MCP. MCP is still fine for a handful of rows.

  Two traps when using it:
  - **`psql ... > file` on Windows writes CRLF.** Pipe through `tr -d '\r'` or every URL you
    feed to `curl` ends in `\r` and returns `000`. This cost two full re-sweeps.
  - Its scripts hang after "PostgreSQL connected" unless they `process.exit(0)`; the audit
    scripts already do.

  Why `ctc_app` fails: it was not deleted. `rolcanlogin = false` **and** zero grants on
  `trivia.*` — a deliberate retirement, not a regression. Root cause and the ask are written
  up for Chris Andrews in `docs/ops/2026-09-27-ctc-database-access.md`; Chris sent it on
  2026-09-27 and the reply is outstanding. Until it lands, `ev_api` is the approved interim.
- **Render MCP — the workspace id is `tea-d69tn76mcj7s738vmt10` (EmpoweredVote).** It is the
  only workspace on the account, and it matches the `ownerId` on the services, so there is
  nothing to choose between. Pass it as `workspaceId` on every Render call and deploy
  verification no longer needs Chris. Session 7 used it to set an env var and confirm the
  cron deploy went live.
  **There is no MCP tool that READS environment variables** — only
  `update_environment_variables`, which merges by default (`replace: false`). A variable's
  value therefore cannot be confirmed from the API at all; set it explicitly and verify from
  what the job itself writes. CTC merges that touch nothing under `frontend/` produce no
  deploy at all, so most ledger PRs still need no verification.

## Pull request status — current as of session 6b

Everything opened by this workstream is **MERGED**. Nothing is awaiting review.

Session 6 added eight more, all merged to CTC master on 2026-09-27:

| PR | What | Merge |
|---|---|---|
| #131 | first `checkLearnMoreLink` sweep of the bank + the expiring-ratio ruling | `2094254` |
| #132 | readiness audit learns the 10% floor (DEFECT / NOTE / silent) | `3dd506d` |
| #133 | queens-ny content: 5 easy NYC questions, 3 verified officeholders | `11c9645` |
| #134 | repair all 57 dead source URLs, and two wrong facts behind them | `d4eb3f6` |
| #135 | **`nested-options` rule** — options that are true at the same time | `211776d` |
| #136 | CTC database access handover doc for Chris Andrews | `dac07a7` |
| #137 | withdraw the ore-203 flag (it was wrong) | `18d7b98` |
| #138 | oregon-state content: agriculture, and why the beaver was declined | `ec6a4e9` |

| PR | Repo | What | Merge |
|---|---|---|---|
| #815 / #816 / #817 | ev-accounts | anachronism rule, pipeline quality gate, topic-map cache fix | merged + deployed |
| #818 | ev-accounts | stance-gate rebucketing (not ours; see below) | `36fd9172` |
| #819 | ev-accounts | **source-drift rule** — the canonical copy, guards the nightly pipeline | `c81b783` |
| #126 | CTC | the audit itself: docs, vendored anachronism rule, playbook | `e466a5d` |
| #127 | CTC | source-drift vendored copy + `audit-source-support.ts` | `3617427` |
| #128 | CTC | oregon-state ledger | `4f72936` |
| #129 | CTC | queens-ny ledger | `2ec8d01` |

Session 7 added five, all merged 2026-09-27/28:

| PR | Repo | What | Merge |
|---|---|---|---|
| #823 | ev-accounts | **`nested-options` mirrored** to the canonical backend, with the 30 tests CTC cannot host | `2ffff0d` |
| #824 | ev-accounts | pin the three advisory repairs as fixtures (33 tests) | `a93e294` |
| #825 | ev-accounts | **per-rule enforcement**, and `nested-options` turned on | `f7bb02e` |
| #140 | CTC | vendor note points at where the tests actually are | `0558f32` |
| #141 | CTC | CLAUDE.md: the enforcement flag is a rule list, not a boolean | `15e8c18` |

**Do not re-merge any of these.** Open a fresh `docs/<slug>-audit` branch off master instead.

### Two CI gotchas, recorded because both look like something worse

1. `ci.yml` in BOTH repos triggers on `pull_request: branches: [master]`. A PR based on
   another PR's branch **never runs CI**, and the required checks then never report. Retargeting
   fires `edited`, which is not a default trigger; closing and reopening fires `reopened`,
   which is. Never stack PRs here.
2. Immediately after a force-push, `gh pr checks` can report `BLOCKED` with *"no checks
   reported on the branch"* — identical in appearance to the renamed-job failure CLAUDE.md
   warns about. It is usually just a polling race. Tell them apart with
   `gh run list --branch <branch>`, which shows whether the run exists.

### New tooling available to this workstream (shipped session 3-4)

- **`checkSourceDrift`** — advisory rule, now in `ALL_SYNC_RULES` in BOTH repos. Free, no
  network, no model. Flags claims resting on a rule, ranking or count an outside body can
  change. 6.3% of the bank bank-wide; expect 8-12% inside a single collection.
- **`backend/src/scripts/audit-source-support.ts`** — stage two, on demand, never scheduled.
  `--slug <collection>` is a DRY RUN that spends nothing. `--judge` opts into network and
  model spend (~1 call per flagged question, `claude-haiku-4-5`); `--write` records the
  supporting excerpt into `fact_snapshot`. It never archives.
  **Chris's `--judge` authorisation so far has been per-collection. Ask before spending.**
  Exercised end to end against louisiana only: 9 flagged, 9 supported after it caught two
  real sourcing defects.

### Known-red, not ours

ev-accounts master CI fails on the `stance sourcing` job — `BALLOTPEDIA_ONLY ks observed
1 (NEW state)`. That job is SKIPPED on PRs and only runs on master pushes, which is why
two green PRs turned master red on merge. It is live-DB drift from the Kansas slice work,
not from anything here: every other counter matches its baseline exactly, and our diff is
`src/trivia/**` plus docs. Handed to the ev-accounts-KY side with a written note.

**RESOLVED AS DIAGNOSED, NOT YET LANDED (updated 2026-09-27, session 3).** They replied
(`~/Desktop/ev-accounts-stance-sourcing-REPLY.md`). Confirmed theirs. Cause was **not a new
row**: `Patrick Schmidt — Social Security`, `updated_at 2026-08-26`, was reused rather than
created by their KS-2 occupancy migration `CC_0157`. Seating him gave `seat.state` a value
where it had been NULL, so an existing row moved buckets. `BALLOTPEDIA_ONLY` total never
changed — it was 179 before and after.

**Our note got the mechanism wrong and the correction belongs on the record.** We inferred
"Kansas went 0 → 1 while some other state dropped by one." It was not another state; it was
the stateless `-` bucket, 7 → 6. Their regenerated baseline showed those two numbers were the
only ones that moved in the entire file. The lesson is ours: we reasoned about a conservation
of counts across *states* when the partition included a null bucket we had not accounted for.

Their fix (PR #818, `fix/stance-gate-rebucketing`) keys the baseline on row identity
`<politician_id>:<topic_id>:<season_id>` instead of per-state counts, which is strictly
stronger — the old model let a fix and a break in the same state net to zero and pass in
silence.

**CLOSED 2026-09-27 18:29 UTC.** #818 merged as `36fd9172`, and the master CI run on that
merge commit came back **`success`** at 18:29:06 -- the first green master since #815 and #816
landed. Their "master goes green on merge" held exactly. The three consecutive red master runs
(16:45, 16:47, 17:38) were all this one re-bucketed row and none of them were ours.

Recorded for the pattern, not the incident: a red master that two green PRs produced on merge,
traced to a gate assumption rather than a bad row, fixed in the gate, with the baseline
correctly left alone and `BALLOTPEDIA_ONLY` still at 179. No row was fixed and none forgiven.

Still true that it blocks nothing here — the required check on CTC's side is `ci ok`, green
throughout.

### The three findings they handed us, and what we said back

Replied in `~/Desktop/ev-accounts-stance-sourcing-REPLY-2.md` (written, not sent anywhere —
same Desktop-file channel the outbound note used).

1. **~152 rows cannot be fixed by the route the gate recommends.** 159 of 179 rows sit in
   closed Season 1, only 7 superseded; an `UPDATE` raises `CLOSED_SEASON_IMMUTABLE`, and the
   gate has no season filter so the closed row keeps counting. **This is Chris's policy call,
   not ours, and we did not decide it.** What we offered: a closed-season row is *discharged*
   when an open-season row exists for the same `(politician_id, topic_id)` **and is not itself
   in the failing bucket** — the guard matters, or the backlog clears itself by being
   restated. That makes the gate and the trigger stop contradicting each other without editing
   history. Caveat we stated plainly: it makes the metric achievable, not small.
2. **`#Campaign_themes` does not mean the candidate wrote it.** 231 rows rest on that
   carve-out. A URL fragment is a *location*, not a provenance, so no tuning of the regex
   recovers authorship — it was never in the string. Fix has to be a provenance value recorded
   at ingest and read back, not re-derived from the URL.
3. **The answers↔context join has no `season_id` condition**, so cross-season pairs fan out —
   670 and 179 against 580 and 165 distinct.

**The ordering constraint we handed back, which they had not connected:** finding 1's "159"
came out of finding 3's fanned query, and a cross-season pair is exactly the shape a
superseded row takes. So fix 3, regenerate, *then* recount 1 — otherwise a policy argument
about closed seasons rests on a figure that moves when four words are added to a `JOIN`. And
regenerate the baseline in the same commit as the join fix, or an identity-keyed gate reads
the mass correction as a mass disappearance and fires on a fix.

### CTC's own version of finding 2 — worth carrying

Their finding 2 made us check ours, and ours is worse. CTC has **no provenance validation at
all**. Two source checks exist and neither asks whether a source supports its claim:

- `checkLearnMoreLink` (`structural.ts`) fetches `source.url` and asserts reachability —
  404/500 blocking, timeout advisory. That is liveness.
- `checkStructure` check 3 asserts the *explanation prose* contains "According to", "Source:",
  a URL, or the source's own name. That is a string match on our own sentence.

A live URL that does not support the claim passes both, permanently. `lou-018` is the worked
example: live source, correct when written, no date, no officeholder, no `expires_at`, and
made wrong by Act 1 of the 2024 special session. Caught by a human reading it. See the
accuracy-drift section in `.planning/COLLECTION-PLAYBOOK.md`.

Their framing generalises and is worth keeping: all three of their findings, and the original
bug, are **a key derived from something that does not determine it** — state from occupancy,
provenance from a URL fragment, pair identity from an unseasoned join. Ours is the same shape:
support inferred from HTTP 200.

### Follow-up with a clock on it

The gate first exercises at **07:00 UTC** (Render cron job `ev-jobs-trivia-pipeline`, not
the in-process node-cron — that is behind `TRIVIA_CRONS_ENABLED`). After that run, read:

```sql
SELECT collection_slug, created_at, notes->'qualityRules'
FROM trivia.generation_jobs
WHERE notes ? 'qualityRules'
ORDER BY created_at DESC LIMIT 10;
```

`suppressed` is the number that decides whether to set `TRIVIA_QUALITY_RULES_ENFORCE=true`.
Expect `pure-lookup` to dominate `byRule` — it matches 15.3% of the live news bank.

## The three carried-forward items are all done

1. **pipelineCron never called the rules engine** — closed by #816. The engine now runs on
   every question the nightly pipeline writes, after `placeAnswer` and before the insert.
   Enforcement is OFF by default: rules run, violations are counted into
   `generation_jobs.notes.qualityRules`, nothing is blocked. **Read `suppressed` there for a
   night or two before setting `TRIVIA_QUALITY_RULES_ENFORCE=true`** — it counts questions that
   *would* have been blocked, which is the cost of enforcing, measured in advance.
   Known in advance: `checkPureLookup` matches 15.3% of the live news bank (274 of 1,788),
   an order of magnitude more than every other rule. Expect it to dominate.
2. **cam-076 / cam-092 living wage** — source-checked. Cambridge's ordinance sets a dollar
   figure (CPI-adjusted each March), pegged to neither minimum wage. Both questions asserted a
   peg that does not exist and were duplicates besides. cam-076 rewritten, cam-092 archived.
3. **Topic cross-wiring** — was logged as cosmetic; it is not. `questionService` puts
   `topics.name` into `Question.topic` and `QuestionCard.tsx` renders it, so **137 active
   questions across six collections showed players another state's topic name**. Fixed by
   giving each collection its own correctly-named topic, following the convention newer
   collections already use (generic display name, prefix-scoped slug). Verified: zero active
   questions in active collections now sit on a topic naming a different state.

## Where the bank stands (measured)

- 43 active collections, **3,313 active questions** (re-measured after session 8; identical
  under all three counting bases — all `status='active'`, those linked to any collection,
  and those in *active* collections)

  The 3,471 figure this line carried before was stale, not wrong at the time: it was taken
  before sessions 7/7b's own archives were applied. 186 of the 234 questions archived on
  2026-09-28 are theirs (washington-dc 62, portland-or 35, pittsburgh-pa 34, plano-tx 29,
  washington-state 25, biloxi-ms 1); the other 48 are session 8's. **Re-measure this number,
  never derive it from the previous value** — nightly yield and automatic expiry both move it.
- **0 `nested-options` violations bank-wide, at either severity** (session 7)
- **0 collections below the 25% easy floor** — spec success criterion 2 is met
- 0 invalid answer indices, 0 questions with other than four options, 0 unlinked
- 2 collections below the 50-question floor: `war-in-iran` (32), `world-news` (44). Both
  pre-existing, both caused by pipeline yield rather than by any purge.

**The floor being met is not the same as the bank being clean.** 20 collections have never been
read. Every one audited so far carried several defect classes, and the seven at 25.7–27.3%
clear the floor only on the labels they already had.

## Next collections, in priority order

tucson-az, federal, fremont-ca, madison-wi, climate-change,
bend-or, wisconsin, california-state, bloomington-in, milwaukee-wi, norwich-uk, indiana-state,
war-in-iran, world-news.

**Take `california-state` earlier than its slot if convenient.** Session 8 archived 18 sound
California questions out of los-angeles-ca on scope grounds (see the ledger entry); they are
recoverable by `external_id` and several would be at home there. Audit it before deciding
whether to revive any, so unaudited content is not dumped into it.

(louisiana — session 3; oregon-state — session 4; queens-ny — session 5. All below.)

## Per-collection method (citation pass added session 7)

0. **Read the cited sources, not just the questions** (Chris, 2026-09-28). Group by
   `source->>'url'` first: a collection that cites one generic article for 20 questions is
   already telling you something. Check the article actually contains each claim. Session 7
   found two live defects this way that no structural rule can see — and cleared one
   question that looked mis-cited and was not, so the check earns its cost in both
   directions.

   **Ask the source for QUOTES, never for a summary.** On plano-tx a summarising fetch of
   the cited article returned two population figures that are not in it (127,885 for 1990,
   824 for 1890). Both contradicted live questions, and acting on them would have
   "corrected" two questions that were right — the article says 128,713 and 1,200. A second
   pass asking for verbatim sentences settled it. A summary is a paraphrase by something
   that has not been told it is being used as evidence; only a quote is evidence.

   Verify titles exist in one call via the MediaWiki API
   (`/w/api.php?action=query&titles=A|B|C&redirects=1&format=json&formatversion=2`) rather
   than fetching each article.
1. Read: `external_id, difficulty, text, options->>correct_answer`, with
   `count(*) OVER ()` so the starting total is measured rather than eyeballed.
2. Read for the defect classes below.
3. One SQL call: archive + relabel + set `expires_at` on officeholders.
4. One SQL call: backfill + guarded `collection_questions` link + verify
   (total / easy_pct / bad_idx / answer-position spread).
5. Easy is a FLOOR, not a band. Never demote an easy question to stay under 33%.

## Defect classes, ranked by how often they actually turned up

1. **Topical concentration.** The single most common defect. 18 of 92 St Louis questions were
   about the Gateway Arch; 14 of 91 Missouri questions about the capitol; 13 of 82 Santa Monica
   questions about the municipal airport.
2. **Repeated-shape officeholder sets.** "Who represents District N?" appeared 8 times in
   Phoenix, 7 in St Louis, 6 in Alexandria with *identical text*. Archive the set, keep at most
   one, and replace it with a question about what the office does.
3. **Mutual leakage.** Two questions with different answers, each printing the other's. The
   duplicate sweep cannot see these — it clusters on answers.
4. **One answer giving away two questions.** A compound answer string that contains two other
   questions' answers (norca-036, tex-022, misso-086).
5. **Answer stated in the question.** "Which department provides FIRE protection?" → "Fire
   Department". Very common.
6. **Minutiae and bracket answers.** Precise figures, and answers like "80,000–99,999 words".
7. **Figures that rot by construction.** "How many CONSECUTIVE years has X been ranked #1."
8. **Inverse pairs**, including a whole generated block (`smo-4xx`) that inverted an existing one.
9. **More than one true option, without any numbers** (added session 7, washington-dc). The
   `nested-options` rule catches this when the options are numeric bounds. It cannot see it
   when they are names. `wdc-414` asked which of four people is an at-large D.C. council
   member and offered Phil Mendelson as a wrong answer — while `wdc-407`, in the same
   collection, asserted that Mendelson's chair seat *is* at-large. Two true options, and the
   collection contradicted itself. The shape to distrust is "which of the following is one of
   the N members of X": if X has four at-large seats and the option list names two of them,
   the question is broken. Repair by replacing the extra true options, not by archiving.
10. **Website furniture** (added session 7, portland-or). Facts scraped off the department page
   that was used as the citation: a room number, opening hours, the colours in an office logo.
   `por-139` asked the room number of the Auditor's office; `por-161` asked its opening hours;
   three separate questions asked about its logo. These are facts about a web page, not about
   civic life, and they are the tell-tale of a collection generated FROM a site's navigation
   rather than about the city.
12. **Off-tier content** (added session 8, los-angeles-ca). A collection carrying another
   tier's subject matter. **18 of 73 Los Angeles questions were about the state of
   California** — the ballot-proposition system, the California student poll-worker
   programme, the number of national parks, how many campsites the state park system has —
   in a *city*-tier collection whose description is "Think you know the City of Angels?".
   A state-tier `california-state` collection (id 5) already existed, and one of the
   eighteen (`lac-042`) was an exact duplicate of a question already in it.
   The tell is the `subcategory`/topic column: ten of them were literally labelled
   `california-state` inside a city collection, so **this one is visible in SQL before you
   read a single question** — group by topic and compare against the collection's tier.
   Archive rather than move: the destination collection is usually unaudited, and moving
   unread questions into it just relocates the work.
11. **Compound answers** (added session 7, washington-state). An answer that bundles two facts:
   "4-year terms, no term limits", "A stratovolcano in the Cascade Volcanic Arc", "42 steps,
   commemorating Washington as the 42nd state". Distinct from class 4 — nothing is leaked,
   the answer is just two questions wearing one coat, and it cannot be marked partly right.
   **On its own this is a readability problem, not a correctness one.** Archive it only when
   it carries a second defect as well; otherwise leave it or split it. Over-archiving on this
   class alone would have cost washington-state six sound questions.

## The readiness gate has two checks the ledger never recorded (session 8)

Both were found by actually running `audit-collection-readiness.ts --slug <slug>` at the end
rather than trusting hand-computed metrics. Earlier sessions reported raw totals, so a
collection that landed on exactly 50 may not have passed.

- **The 50-question floor is applied to a NET count: total minus questions expiring within
  90 days.** los-angeles-ca sat at 51 raw and was `NOT READY — BLOCKED` at net 48. Election
  questions are precisely the ones that trip this, because a runoff dated six weeks out is
  both the best expiring content available and a question the gate already discounts.
  **Size the backfill against net, not total**, and re-run the script rather than doing the
  arithmetic yourself. plano-tx and portland-or both finished at exactly 50 raw — worth
  re-checking them.
- **It also audits distractor bracketing on numeric questions**, which is a defect class
  nothing else here catches. If the correct number is never the smallest or largest of the
  four offered, "sort the options and take the middle" scores 50% with no knowledge. Session
  8's first backfill scored **0.0% at an extreme**. The fix is to design some option sets so
  the answer sits entirely above or below the others (for "9 members" offer 9/11/13/21, not
  5/7/9/11). The script says this explicitly and it is worth repeating: **rotating answer
  POSITIONS does not fix bracketing and masks it** — they are two different checks and the
  script prints both.

## Four ways a citation can be live and still be worthless (session 8)

The link sweep answers one question — did the server return 200 — and the three documented
false-positive modes (429 storms, 403 bot-blocks, CRLF) all make a *live* link look dead.
los-angeles-ca produced two of the opposite kind, which are more dangerous because nothing
flags them:

- **The soft 404.** `bos.lacounty.gov/about-us/` returns **200** and the body reads "The
  content you are looking for is not here." A status-code sweep calls it healthy.
- **The 200 with no text in it.** `cao.lacity.gov` is a JavaScript application; curl and
  WebFetch both receive a shell containing a copyright line and nothing else. Two budget
  questions cited it. The claim cannot be checked there by any automated means, and could
  not be checked by a player either.
- **The moved site.** `ocp.lacounty.gov` returns 200 and says "This site has moved." Following
  it found that LA County renamed the Office of Child Protection to the Office of Child,
  Youth, and Family Well-Being by Board motion on 2026-03-17 — so `lac-043`, which asked
  players to name that office, had been wrong for six months. **A redirect notice on a cited
  page is a staleness signal about the question, not a broken link.**
- **The bot-blocked page you cannot verify.** `codelibrary.amlegal.com` and `upi.com` both
  return 403 to everything. That is a documented false positive for *liveness*, but it also
  means you cannot read the page to confirm support. Prefer a source you can actually open.

`la-057`/`la-086` is the worked example of why this matters: two questions citing the same
text-free budget homepage gave **contradictory answers** to the same question — "largest
source of revenue" was Utility users tax in one and Property tax in the other. Both passed
every structural check the repo has, for years.

## Election-night reporting is not the result (session 8)

Extends "a search summary is not a source", and it caught a wrong explanation before commit.
Writing up the 2002 San Fernando Valley secession vote, the Daily Bruin's election-night
story (2002-11-05) reported that inside the Valley "51 percent voting against secession and
49 percent voting in favor". The **certified** count was the other way: 135,737 yes (50.72%)
to 132,831 no. The measure carried inside the Valley and lost citywide 66.97–33.03.

A contemporaneous news report is a primary source for *what was known that night*, not for
the outcome. For anything decided by a count, cite the canonical tally.

## Two rules learned the hard way this session

**Archiving minutiae is what moves easy%, not relabelling.** Every collection rose 10–20 points
with fewer than five promotions, because minutiae skew medium/hard. A cleaned collection lands
near 35–40% easy on archiving alone.

**Verify an officeholder before "correcting" it.** Two questions this session looked stale and
were right: Alexandria's mayor (left office 2018, beat the incumbent in 2022 and returned) and
Phoenix's city manager (predecessor rehired Nov 2025). A predecessor returning makes a correct
question look wrong. Check before you fix.

## Two blind spots in the checks themselves (session 8)

**The duplicate-answer check clusters on exact strings, so a re-spelling defeats it.**
los-angeles-ca reported **zero** duplicate answers while LACMA was the answer to three
questions — as `LACMA`, `LACMA (Los Angeles County Museum of Art)` and `Los Angeles County
Museum of Art (LACMA)` — and La Brea to two, as `La Brea Tar Pits & Museum` and `La Brea Tar
Pits Museum`. Normalise before grouping:

    lower(regexp_replace(options->>correct_answer,'[^a-z0-9]','','gi'))

**Explanations leak too, and no check reads them.** The leakage queries here compare one
question's *text and options* against another's answer. `la-105`'s explanation mentioned "the
county's 88 cities", which is `la-125`'s whole answer, and explanations are shown to the
player after they answer. Caught by eye, not by the sweep. When you write a backfill, read
the explanations against each other as well as the questions.

## Still open, not fixed

- ~~**NINE live questions mark a correct answer wrong.**~~ **DONE in session 7.** Eight were
  repaired with honest, mutually exclusive brackets; `bxl-175` was archived rather than
  repaired. Three further *advisory* hits this list never named — `cam-025`, `nysts-055`,
  `wdc-025` — were repaired at the same time. The original nine were:

      bxl-153   Over $200,000 / $400,000 / $600,000 / $800,000   answer $400,000
      bxl-175   Over 25 / 30 / 35 / 40                           answer Over 40
      climc-0053  More than 1,000 / 2,500 / 5,000 / 10,000       answer 5,000
      climc-0059  More than 800 / 1,000 / 1,400 / 2,000 people   answer 1,400
      por-143   Over 8 / 9 / 10 / 11 decades                     answer Over 11
      por-288   Over 1,000 / 2,000 / 3,000 / 5,000 acres         answer Over 5,000
      tucaz-054 Over $25m / $60m / $100m / $138m                 answer Over $138m
      wdc-068   $5,000 / $10,000 / $15,000 / $25,000 and below   answer $10,000
      wmnla-038 10+ / 25+ / 50+ / 100+                           answer 50+

  Two of the eight had a **wrong answer, not merely a wrong option set**, which is the
  finding worth carrying: `wmnla-038` claimed "more than 50 antique stores" citing a
  Wikipedia article that never mentions Antique Alley (the sourced figure is over 40), and
  `bxl-175` claimed "over 40 Mississippi libraries damaged beyond repair" citing an article
  containing no mention of libraries at all. **A rule that fires on structure will surface
  questions whose facts are also wrong — check the citation, not just the options.**

  Re-list any time with `npx tsx src/scripts/audit-nested-options.ts --blocking-only`.
- ~~**The `nested-options` rule is not yet mirrored into ev-accounts.**~~ **DONE in session 7**
  (ev-accounts #823). The tests live only beside the ev-accounts copy, because this repo has
  no test runner — a change made to CTC's copy is untested until it is carried over. #824
  pinned all 11 repaired option sets as fixtures. #825 then made enforcement **per rule** and
  switched `nested-options` on in production.
- **`war-in-iran` (32) and `world-news` (44) are below the 50-question floor.** A pipeline-yield
  problem, not a purge problem. #816 does not add yield; if anything, enforcing the gate will
  reduce it, which is another reason to read `suppressed` first.
- ~~**`replacementGenerator.ts` and the two officeholder generators never call
  `auditQuestion`.**~~ **DONE in session 7** (ev-accounts #827), and the claim was wrong on
  one count: **`replacementGenerator.ts` already had the gate** — it audits and refuses on
  `hasBlockingViolations`. It was two addresses, not three.

  `CurrentTermQuestionGenerator` and `ElectionQuestionGenerator` were the real gaps. Both
  already called `placeAnswer`, so only the audit was missing; it now runs between
  `placeAnswer` and the insert, on the placed question. The gate lives in one shared
  module (`services/generation/auditBeforeInsert.ts`) rather than two inline copies.

  It reuses the **per-rule** flag rather than gating on `hasBlockingViolations`, and that
  choice matters more here than in the pipeline: these produce officeholder questions, which
  are exactly the shape `checkPureLookup` flags at 15.3%. A blanket gate would have refused
  most of their output. Both write `status: 'draft'`, so nothing reaches a player until
  activation — lower urgency, same defect.

---

## Session 7 — the nested-options slice (2026-09-28)

No collection was audited. The whole session went to the bank-wide blocker above.

**What shipped:** 11 live questions repaired, 1 archived, the rule mirrored to ev-accounts
with its first tests, and per-rule enforcement built so it could actually be switched on.
`TRIVIA_QUALITY_RULES_ENFORCE` is now a comma-separated rule list rather than a boolean, set
to `nested-options` on the cron job — see the new section in CLAUDE.md.

**Three things worth carrying into the next collection:**

- **Sweeping the bank through MCP is cheap if the rule's precondition is pushed into SQL.**
  The DB note above is right that MCP costs ~10k tokens per 300 rows — but a sweep does not
  need the rows. Reimplementing the rule's classification as a `CASE` over
  `jsonb_array_elements_text(options)` and returning only questions that meet the violation
  precondition turned a 3,471-question sweep into a five-row result set. The real rule was
  then run in TypeScript over just those candidates. Useful whenever `psql` is unavailable.
- **`.env` reads can be blocked by a permission deny rule**, which makes the `psql` recipe
  above unusable without warning — the failure reads as a grep error, not a permissions one.
  The SQL-sweep trick above is the fallback.
- **An empty night proves nothing.** The pipeline yields 0–4 questions on many nights, so
  `audited: 0` in `generation_jobs.notes.qualityRules` looks identical to a working gate.
  Do not read a quiet run as confirmation.

**Still unverified:** whether the env var actually reached the running cron job. It cannot be
read back from the Render API. The 07:00 UTC run on 2026-09-28 writes `enforcedRules` into
`generation_jobs.notes.qualityRules`; that row is the confirmation, and a scheduled check is
armed for 15:00 UTC that day.

---

# SDD ledger — plan: docs/superpowers/plans/2026-09-26-collection-quality-audit.md

Spec: docs/superpowers/specs/2026-09-26-collection-quality-audit-design.md (read)
Worktree: C:/ctc-quality-audit on feat/collection-quality-audit, cut from origin/master 5253f6c

## Pre-flight scan (shared interfaces)

| producer | consumer | produces vs consumes | finding |
|---|---|---|---|
| Task 1 | Task 2 | `checkAnachronisticYear(q: QuestionInput): RuleResult` vs same | clean |
| Task 1 | Task 3 | rule file at ev-accounts path vs `cp` source | clean |
| Task 3 | Task 5 | `backend/src/services/qualityRules/rules/anachronism.ts` vs import `../services/qualityRules/rules/anachronism.js` from `backend/src/scripts/` | clean — resolves |
| Task 4 | Task 7 | post-purge active bank vs export source | clean — HARD ORDER: 4 must complete before 7 |
| Task 6 | Tasks 8, 10 | revised rubric vs the judgement/authoring standard | clean |
| Task 7 | Tasks 8, 9 | record shape incl. `rewriteOptions` + `rewriteCorrectAnswer` vs filled/consumed | clean — all three carry `rewriteCorrectAnswer` |
| Task 9 | Task 10 | relabelled bank vs gap computation | clean — Task 10 Step 1 recomputes, does not reuse pre-relabel figures |

Task 9 `DIR = path.resolve(process.cwd(), '../.planning/difficulty-audit')` — cwd is `backend/` when run as planned, resolves to repo-root `.planning/difficulty-audit`. Clean.

## Rulings

Task order: Ruling: execute 4 -> 6 -> 7 -> 8(cambridge-ma) before 1/2/3/5 — Chris asked to "start with cambridge", and the dedup purge is what actually fixes the Cambridge complaint; Tasks 1-3 (anachronism) share no interface with 4/6/7/8 so nothing is blocked — cost if wrong: none, the anachronism tasks run unchanged afterwards.

Task 4: Ruling: review ALL 77 clusters, not only the 3 of size >=4 the plan called for — the size>=4 eyeball measured a false-positive rate of 2 clusters in 3 (11 questions of 17). Norwich clusters 4302/4303 are legitimate question FAMILIES that share an answer by design ("which authority is responsible for bin collections / planning / council tax ... in Norwich?" -> all "Norwich City Council"). Answer-equality was the spec's guard against exactly this and it does NOT hold: a family can share an answer as its subject. Auto-applying to the 74 unreviewed clusters would archive legitimate content. Reviewing all 77 clusters (177 questions) is cheap next to the 3,855-question relabel — cost if wrong: ~30 min of reading.
Task 4: Ruling: the discriminator is DIRECTION OF VARIATION, not similarity — if what varies between two questions is the SUBJECT (bin collections vs planning applications) they are a family and both stay; if what varies is only PHRASING of the same subject (cam-018 "minimum percentage" vs cam-058 "minimum share") they are duplicates and one goes — cost if wrong: a kept duplicate is a repeat a player may see twice; an archived family member is lost content, so the rule errs toward keeping.
Task 4: Ruling: do NOT commit the dedup report — `.gitignore:57` ignores `.planning/dedup-reports/*.md` by design (only `.gitkeep` is tracked), and the plan's "commit the report" step contradicts the repo convention. The report stays on disk as scratch; the durable finding (family-vs-duplicate discriminator) goes into the TRACKED `COLLECTION-PLAYBOOK.md` §5 instead — cost if wrong: the per-cluster detail lives only in the commit message and this ledger.
Task 4: Expected-vs-actual: plan Step 5 expected ZERO rows from the re-run. Actual 35 rows, all from the 12 excluded family clusters. Not a failure — a consequence of the family ruling above. The correct assertion is "zero pairs outside the excluded families", which holds.
Task 4: complete (commit 4378420, verification: selection query -> 35 pairs all from excluded families, 0 true dups; floor check -> only war-in-iran/world-news, both pre-existing)
Task 6: complete (commit 14cb813, tests: tsc --noEmit -> EXIT=0 clean; baseline on master also 0)
Task 6: Ruling: verified tsc against a FULL npm install in the worktree, not the truncated node_modules copy — the copy produced 4 errors (2 missing modules, 2 implicit-any downstream of them) that a clean install cleared, and master's baseline was 0. Trusting the partial copy would have reported a false regression — cost if wrong: none, the stricter check passed.

## Task 8 — cambridge-ma (first collection)

Task 8: Ruling: the plan's reason-code table is incomplete — it has codes for easy-promotions and hard-demotions but none for "correctly medium". Added `PROCESS_STRUCTURE` (institutional process, who-appoints-whom -> medium) and `NONICONIC_DATE` (a date that is not a founding year -> medium), both straight from the rubric's own MEDIUM definition — cost if wrong: two labels in a report.
Task 8: Ruling: `TERM_LENGTH -> easy` applies only to offices a resident actually knows — mayor, governor, council member, president. Cambridge Election Commissioners' 4-year term stays MEDIUM. Chris's examples were all headline offices; reading the code literally would promote the term length of every obscure appointed board, which fails the rubric's own "what must the player bring" test — cost if wrong: a handful of board-term questions sit one tier too high.
Task 8: Ruling: archived 17 further duplicates the Task 4 clustering could not see, because the answers differ as STRINGS while naming the same fact: "2 years"/"Two years" (cam-003/053), "260 workers"/"Approximately 260" (cam-024/062), "Five"/"Five times" (cam-029/081), three Plan E variants (cam-033/040/085), three "national model" variants (cam-045/130/134), four proportional-representation variants (cam-030/052/054/064). This is exactly the pla-049/pla-080 blind spot recorded in playbook §5, and Cambridge shows it is not rare — cost if wrong: 17 reversible archives, each re-checkable by external_id.
Task 8: Ruling: archived 3 questions on quality grounds rather than duplication — cam-125 is ungrammatical AND its answer "Its 34th year" is relative to now, so it rots silently; cam-142 and cam-149 ask what something "reflects"/"what aspects evolved" with four soft paraphrases and no checkable answer. Chris's ask was duplicates AND "questions that don't hit our quality bar" — cost if wrong: 3 reversible archives.
Task 8: FINDING (not fixed by archiving): cam-076 says the living wage ordinance requires pay above the STATE minimum; cam-092 says above the FEDERAL minimum. Both are active, both cannot be right. Needs a source check, not a label.
Task 8 (cambridge-ma): complete. 124 active at start -> 95 after Task 4 dedup -> 75 after 17 missed dups + 3 quality archives -> 87 after +12 easy backfill.
  Difficulty relabel yield: 15 changes of 95 read = 16% (Queens pilot reference: 13%). In band.
  Easy: 38.7% -> 24.0% (archiving removed many duplicate easies) -> 34.5% after backfill.
  Verification: bad_answer_index 0; new same-answer dups 0; answer position spread 26/18/20/23; total 87.
  Backfill filled a measured topical hole: BEFORE, Cambridge had 0 questions mentioning Harvard, MIT, the Charles River, Middlesex County, its founding, or the sitting Mayor, while 25 of 75 were election administration and 22 were Rindge/CRLS school history.
Task 8: Ruling: verified the Mayor by web search before writing cam-159 (Sumbul Siddiqui, elected by the Council Jan 2026, expires_at 2028-01-31) rather than writing an officeholder question from memory — an expiring question sourced from recall is how a collection ships a wrong fact — cost if wrong: one search.

## Re-sweep with loosened answer key (Chris, 2026-09-27)

Ruling: implemented Chris's "loosen the answer key" as HARDER NORMALISATION + exact equality, NOT trigram similarity on the key as the option text described. Similarity on short numeric answers is actively wrong: "2years" vs "4years" scores high, so a 2-year term question would merge with a 4-year one and one would be archived. Canonicalising number words to digits, stripping qualifiers ("approximately", "over", "more than") and singularising trailing units achieves the intended catch ("Two years"=="2 years", "Approximately 260"=="260 workers") while keeping 2 != 4 — cost if wrong: a duplicate whose answers differ semantically rather than orthographically still survives, same as before.
Re-sweep: the loosened answer key alone found NOTHING new at text-similarity > 0.55 — the limiting factor was never the answer key, it was the TEXT threshold. Cambridge's misses sat at 0.35-0.55. Re-ran that band: 24 further true duplicates archived across 15 collections (alexandria, arizona, bainbridge, bloomington, indio, LA, massachusetts, mississippi, oregon, plano, santa-monica, tucson, washington-dc, world-news).
Re-sweep: Ruling: families held at the lower threshold too and were left intact — Texas's two high courts (same selection method, same 6-year term), Pennsylvania governor vs senator (both 4 years), Portland's two District-4 councillors, Wisconsin's coincidental 1848s (constitution ratified / UW-Madison founded), Mississippi's current AG vs first woman AG (same person, different facts) — cost if wrong: a surviving duplicate, which is cheaper than deleting a real question.
Re-sweep: Ruling: archived arizs-047 and mis-068 on QUALITY not duplication — arizs-047 asks what fossil the Petrified Forest is known for with the answer "petrified wood" (the question contains its own answer), mis-068 asks which official is "constitutionally the most powerful", a vague superlative the ambiguity rule exists to catch — cost if wrong: 2 reversible archives.
Re-sweep: NOTE world-news 44 -> 43 active, further below the 50 floor. Permitted by the verification rule (it was already below), but flagged: world-news and war-in-iran are thin because of pipeline yield, not this purge.
Ruling: reordered again — doing Tasks 1/2/3/5 (the anachronism rule, end to end) BEFORE finishing the 42-collection content grind. The backfill backlog is now measured at ~150 new easy questions to clear the 25% floor (17 collections below it) and ~259 to reach 30% across all 43. That is a long content effort; the anachronism rule is self-contained, closes one of Chris's three stated complaints completely, and shares no interface with the content work — cost if wrong: none, the ordering is free.
Task 1: complete (ev-accounts claude/trivia-anachronism-rule, PR #815, tests: vitest src/trivia -> 186/186).
Task 2: complete (rule registered; auditQuestion returns hasBlockingViolations for wnews-0134).
Task 1/2 FOLLOW-UP: Ruling: running the rule against the live bank found a FALSE POSITIVE, fixed TDD-first rather than accepted. smo-407 ("Ellis Raskin WAS ELECTED ... for a term ENDING in which year?", answer 2028) is past tense but asks for a future term boundary. bxl-414 is the same shape without a past-tense verb and already passed, so only half the case was covered. Added a narrow FUTURE_BOUNDARY exemption (requires "term(s)" immediately followed by end/expiry) that outranks the past marker, with "In what year was the council term limit first adopted?" pinned as a still-flagging test so the exemption cannot widen — cost if wrong: a real anachronism inside a term-ending question would pass, which no live question exhibits. 189/189.
Task 3: complete (vendored to CTC with provenance header, registered, harness extended, tsc --noEmit EXIT=0).
Task 5: complete. Worktree cannot reach the DB (pooler EAUTHQUERY even with .env copied), so used the plan's documented fallback: SQL prefilter for any option containing a year > current, then ran the real TS rule over those 14 rows. 1 genuine violation. wnews-0134 fixed: options 2023-2026, correct_answer 3, answer still "2026". Re-verified: 14 candidates, 1 flagged before the fix, 0 after.
NOTE: audit-anachronism.ts is committed and correct but UNRUN against a live DB — the worktree has no working connection. Run it from the main checkout to exercise it end to end.

### biloxi-ms — complete
108 -> 99 (9 archived) -> 119 (+20 easy). Easy 16.7% -> 30.3%. bad_answer_idx 0, dups 0, answer spread 35/30/29/25.
  Archived: bxl-401 (dup of bxl-004 mayor, answer strings "Gilich"/"Gilich, Jr." hid it), bxl-404 (dup of bxl-001 govt form), bxl-406 (dup of bxl-003 council election), bxl-421/422/423 (INVERSES of bxl-407..413 -- "who represents Ward 1" vs "which ward does X represent", same fact both ways; also 10 questions on 7 councillors breached the 1-per-officeholder rule), bxl-075 (answer restated in the question: "what boats are in the CHARTER FISHING exhibit" -> "Charter boats"), bxl-070 + bxl-072 (soft exhibit-inventory questions with no checkable answer).
  FACTUAL CORRECTION: bxl-104 asked how many people DIED in the April 1960 Bloody Wade-In, answer "10". Verified against BlackPast/MS Civil Rights Project: 10 people were SHOT (8 Black men, 2 white men); two Black men died that week. Question text and explanation rewritten to ask about gunshot wounds; answer index unchanged.
  Topical concentration mirrored Cambridge: 12 of 108 questions were about one museum, 10 about ward councillors.
  Added bxl-501..520: founding 1699, Jefferson Davis/Beauvoir, Shuckers, casino gaming, "Seafood Capital", Biloxi Bay Bridge, mayoral term, US-90/lighthouse median, Camille, Deer Island, George Ohr, NPS, I-10, Back Bay, Vietnamese shrimping, strong-mayor, Keesler training, Blessing of the Fleet, Mason/beaches, Harrison County dual seats.

### new-york-state — complete
86 -> 77 (9 archived) -> 90 (+13 easy). Easy 17.4% -> 30.0%. bad_idx 0, dups 0, spread 24/23/21/22.
  Concentration: 14 of 86 on the State Capitol BUILDING (five on one staircase), 9 on SUNY, 6 on GDP.
  NEW DEFECT CLASS FOUND -- CROSS-QUESTION ANSWER LEAKAGE. One question's TEXT gives away another's answer:
    nysts-037 "Where was the first women's rights convention held in 1848?" (Seneca Falls)
    nysts-042 "In what year was the Seneca Falls Convention -- the FIRST women's rights convention in U.S. history -- held?" (1848)
    Each states the other's answer. Archived nysts-042 as a mutual-leakage duplicate.
    Also de-leaked by rewording rather than archiving: nysts-054 (named Niagara as "the first state park" -- the answer to nysts-053) and nysts-017 (said "(fourth)" -- the answer to nysts-011).
  This is a class the duplicate sweep CANNOT see: the two questions have different answers, so answer-key clustering never pairs them. Worth a playbook entry.
  Archived: nysts-042, nysts-051, nysts-060 (staircase 5th/6th question), nysts-057 (leaked nysts-046), nysts-070, nysts-078, nysts-081, nysts-080 (SUNY marketing trivia), nysts-026.
  EXPIRY FIX: six officeholder questions (Governor, AG, Comptroller, Speaker, Majority Leader, Lt Gov) had NO expires_at. Set to 2027-01-31 (statewide terms elected 2022 end Jan 2027).
  RUBRIC: only the Governor stayed easy. AG -> medium; Comptroller/Speaker/Majority Leader -> hard. Lt Governor kept MEDIUM: Chris named VP as easy, but the written rule lists only Mayor/Governor/President/VP and a state Lt Gov is genuinely obscure -- did not stretch the rule.
  BUG (not fixed, cosmetic): New York questions are assigned topic_ids named "Oregon State Government" (489) and "Mississippi State History and Founding" (583). Topic assignment is cross-wired between state collections.

### mississippi-state — complete
84 -> 72 (12 archived) -> 79 (+7 easy). Easy 17.9% -> 30.4%. bad_idx 0, spread 18/23/18/20. 2 "dups" remain and are BOTH intentional families (state flower/tree = Magnolia; current AG / first woman AG = Lynn Fitch).
  Concentration: FIVE questions on the 1964 MFDP / Democratic National Convention, six on the state flag.
  INVERSE PAIRS archived (same fact asked both directions): mis-158 (vs mis-033, Delta), mis-220 (vs mis-039, Jackson capital), mis-190 (vs mis-066, workforce participation -- mis-190 was also MALFORMED: asked "what percentage ... was recorded at 56 percent?" and answered "Among the lowest in the nation").
  MUTUAL LEAKAGE archived: mis-015/mis-203 (each names the other's answer: Hamer / MFDP) -> kept mis-203; mis-178 (its text says "farm-raised catfish", the answer to mis-051, while mis-051's text says "more than half", the answer to mis-178) -> kept mis-051.
  Also archived: mis-233 + mis-021 (3rd and 4th MFDP questions), mis-038 (vs mis-151, 1890 constitution), mis-061 (outdated "$10,000 bracket" framing vs mis-198 flat rate), mis-225 (leaked mis-095's "21 stars"), mis-096 + mis-200 (vote-margin and 2012-ranking minutiae).
  EDITORIALISING removed: mis-208 asked who is Lt Governor "serving as the most powerful figure in state government" -- the same subjective claim mis-068 was archived for. Reworded, demoted easy -> medium.
  EXPIRY: 11 officeholder questions and 4 volatile economic stats had no expires_at. Officeholders -> 2028-01-31 (MS statewide elected Nov 2023); stats -> 2027-06-30.
  Added mis-301..307: Tennessee border, 1817 statehood, Delta blues, mockingbird, Ole Miss/Oxford, Arkansas+Louisiana, state motto.

### indio-ca — complete
67 -> 63 (4 archived) -> 68 (+5 easy). Easy 19.4% -> 30.9%. bad_idx 0, spread 18/16/19/15.
  FACTUAL FIX (2nd live error found): ica-014 said Indio's California Assembly member is Eduardo Garcia. Garcia was TERMED OUT in 2024; Jeff Gonzalez (R) has held the 36th district since -- and Gonzalez was sitting in the question's own distractor list, so the question was serving a wrong answer while displaying the right one. Verified by search. Options reordered (Garcia kept as a distractor, which is now a good one), correct_answer -> Jeff Gonzalez, expires_at 2027-12-31, difficulty -> hard.
  Archived: ica-052 (mutual leakage with ica-018 AND ica-033: "which festival has been held at the Empire Polo Club since 1999" names both the venue and the year those two ask for), ica-153 (its answer "Indian Wells" is stated in the TEXT of both ica-026 and ica-027), ica-095 + ica-078 (5th and 6th SunLine questions -- JPA member count and paratransit brand name).
  ica-001 (Mayor) given expires_at 2026-12-31: Indio rotates the mayoralty among councillors, so it turns over faster than a normal term.
  Added ica-201..205: Riverside County, Coachella Valley, dates, I-10, Salton Sea.

### bainbridge-island-wa — complete
91 -> 83 (8 archived) -> 90 (+7 easy). Easy 19.8% -> 28.9% (inside the 25-33% band). bad_idx 0, spread 23/23/21/23.
  Concentration: 15 of 91 on the Japanese American Exclusion Memorial, 11 on council members, 5 each on Fort Ward, pickleball and BIMA.
  ANSWER-IN-QUESTION archived: bniwa-027 asked what crop made the island "the STRAWBERRY capital of the Pacific Northwest" and answered "Strawberries". bniwa-036 covers the same fact properly.
  MUTUAL LEAKAGE archived: bniwa-019/bniwa-032 -- 019's text says the residents "were the first in the United States to be forcibly removed" (032's answer) while 032's text says "March 30, 1942" (019's answer). Kept 019.
  Also archived: bniwa-033 (leaked bniwa-021's "276"), bniwa-052 (same fact as bniwa-038, and "Old Ironsides" gives it away), bniwa-089 (same as bniwa-082), bniwa-094 + bniwa-095 (ward questions derivable from, and leaking, bniwa-012/014/016).
  STALE ARCHIVED: bniwa-092 asked when the city manager's retirement would take effect -- "January 30, 2026", already in the past.
  De-leaked by rewording: bniwa-024 (dropped "listing the names of all 276"), bniwa-043 (dropped "that would become the largest of its kind in the world", which was bniwa-044's answer).
  EXPIRY: 10 council/legislative officeholder questions had none -> 2028-01-31.
  Gap filled: the collection asked what YEAR pickleball was invented and WHO invented it, but never WHAT SPORT was invented there. Added that plus Olympics/Rainier/Seattle/Bloedel/Agate Pass/state.

### asheville-nc — complete
97 -> 81 (16 archived) -> 88 (+7 easy). Easy 20.6% -> 30.7%. bad_idx 0, spread 21/23/25/19.
  UNANSWERABLE-AS-POSED archived: ashnc-012 and ashnc-016 BOTH ask "which council member's term ends December 2028" and give DIFFERENT answers (Sage Turner / Bo Hess). Several members qualify, so neither question has a unique answer. Same defect in ashnc-095/096 for December 2026 -> archived 096 (which also named Smith, 095's answer).
  MUTUAL LEAKAGE archived: ashnc-014 (its text names Manheimer, ashnc-004's answer, while 004's text says "since 2013", 014's answer); ashnc-030 (its text says "Buncombe Turnpike", ashnc-023's answer, while 023's says "livestock trade", 030's answer); ashnc-013 (its text says "six at-large members", ashnc-003's answer); ashnc-015 (names Wesley, ashnc-006's answer).
  Also archived: ashnc-017 (NEGATIVE framing -- "which feature does NOT exist" -- plus it leaks ashnc-003), ashnc-052/053 (9th and 10th Biltmore questions), ashnc-054 (overlaps 044), ashnc-061/076/077/080 (minutiae: Wolfe's age at university, UNCA first degrees, Beer City poll win count, Sister Cities count), ashnc-090 (asked which STATE Asheville is the 11th most populous city in -- trivially the collection's own state).
  Concentration: 10 Biltmore, 6 Basilica/Guastavino, 6 Thomas Wolfe, 4 UNCA.
  EXPIRY: 11 officeholder/election questions -> 2028-12-31.
  Added ashnc-201..207: state, Grove Park Inn, Mount Mitchell, Pisgah NF, Tourists, Pack Square, Blue Ridge Parkway endpoints.

### philadelphia-pa — complete
96 -> 93 (3 archived) -> 102 (+9 easy). Easy 20.8% -> 30.4%. bad_idx 0, spread 26/27/25/24.
  Noticeably stronger source material than the other collections so far -- only 3 archives.
  ANSWER-IN-QUESTION archived: phipa-063 asked why the museum staircase is called the "ROCKY Steps" and answered "Rocky (1976)".
  Also archived: phipa-012 (a strict subset of phipa-003, which states its answer), phipa-076 (names "the Curse of Billy Penn", phipa-056's answer, and duplicates phipa-069 on the 2008 Phillies).
  De-leaked by rewording: phipa-055 stated "at 548 feet", which is phipa-052's answer; dropped from both text and options.
  EXPIRY: 14 officeholder questions (mayor, council president, DA, controller, leadership, 7 district members) -> 2028-01-31.
  Added phipa-201..209: state, Delaware River, City of Brotherly Love, Mummers Parade, Betsy Ross House, Franklin Institute, Boathouse Row, Eagles, Reading Terminal Market.

### pennsylvania — complete
95 -> 87 (8 archived) -> 91 (+4 easy). Easy 21.1% -> 30.8%. bad_idx 0.
  STATE-SCALE VIOLATION, the playbook rule nobody had enforced: Pennsylvania was asking EIGHT questions that philadelphia-pa also asks -- same Liberty Bell scripture (penns-038 = phipa-048), same Independence Hall UNESCO 1979 (penns-045 = phipa-042), same 1790-1800 capital span (penns-043 = phipa-040), same Declaration venue, same Constitutional Convention city, same Penn-founded-Philadelphia-1682, same Franklin-founded-Penn-1740, same street plan. Archived from the STATE collection; the city owns them. Philadelphia AND Pittsburgh both exist, so this rule binds hard here.
  De-leaked: penns-071 named "architect Joseph Miller Huston", which is penns-058's answer.
  EXPIRY: 11 officeholder questions -> 2029-01-31.
  Added penns-201..204: Harrisburg, Lake Erie, Punxsutawney, Lancaster County Amish.

### PRODUCT-WIDE cross-collection duplicate scan
Ran once rather than per collection. Key result: MOST high-similarity cross-collection pairs are NOT defects -- they are the same question SHAPE applied to DIFFERENT jurisdictions (Texas vs Oregon term lengths, Indiana vs California governor terms, Plano vs Phoenix government form). A player sees one collection at a time, so parallel questions across states are legitimate and expected. Do NOT archive those.
Only SAME-JURISDICTION pairs are real. Four found and archived:
  phxaz-081 = arizs-089 "In what year was Arizona State University founded?" -- similarity 1.00, identical text
  phxaz-079 = arizs-083 "ASU's main campus is located in which city?" -- similarity 1.00 (answer is Tempe, which reads oddly inside a PHOENIX collection)
  fre-115 = cal-121 "How many members serve in the California State Assembly?" -- a STATE fact sitting in the Fremont CITY collection
  bli-047 = ins-024 "What is Indiana's state motto?" -- a STATE fact sitting in the Bloomington CITY collection
Ruling: kept the STATE collection's copy in each case and archived the city's -- cost if wrong: a state-scale fact is one collection further from a city player.

### springfield-mo — complete
94 -> 87 (7 archived) -> 96 (+9 easy). Easy 21.3% -> 30.2%. bad_idx 0.
  Concentration: 14 of 94 on Route 66, 14 on the Battle of Wilson's Creek, 8 on council seats.
  De-leaked by rewording (4): sprmo-021 named Campbell (sprmo-022's answer); sprmo-027 said "of which Springfield is the county seat" (sprmo-026's answer); sprmo-050 said "compared to about 5,400 Union soldiers" (sprmo-042's answer); sprmo-040 named "General Nathaniel Lyon" (sprmo-039's answer).
  Archived as minutiae: the intersection where a 1991 road sign was erected, the count of restaurants serving cashew chicken, the city's bond rating, a 3-year employment-growth percentage, gross metropolitan product, battlefield acreage (15th Wilson's Creek question), and an annual accounting award.
  EXPIRY: 14 officeholder questions -> 2029-04-30.
  Added sprmo-201..209: state, Ozarks, I-44, Branson, Bass Pro HQ, Missouri State, Springfield Cardinals, southwest Missouri, Drury.

### massachusetts-state — complete
75 -> 61 (14 archived) -> 68 (+7 easy). Easy 21.3% -> 30.9%. bad_idx 0.
  The most repetitive collection found so far. FIFTEEN of 75 questions were about the Governor's Council, and FOUR separately asked for the same fact -- that the 1780 constitution is the world's oldest functioning written constitution (mas-062/077/079/095), with mas-078 stating it in its own text as well.
  Duplicate SETS archived: mas-030 (= mas-024, "what makes the Council unusual"), mas-027 (= mas-019, its role in judicial appointments), mas-081 (leaks mas-018's "8 members"), mas-037 (leaks mas-031's "Parole Board"), mas-077/079/095/078 (the oldest-constitution set), mas-088 (= mas-069, 1779 convention innovation), mas-094 (= mas-066, amendment process), mas-064 (= mas-060, 2006 health care), mas-073 (= mas-046, Writs of Assistance -- mas-098 was the THIRD copy, archived in the earlier re-sweep).
  INVERSE PAIR archived: mas-001 "What is the official name of the MA legislature?" -> "The General Court" vs mas-007 "What is the Massachusetts General Court?" -> "The state legislature". Kept mas-001.
  NOT-CIVICS archived: mas-013 asked how citizens find their legislator, answer "By using the 'Find My Legislator' tool on malegislature.gov" -- a website-usage question.
  Lt Governor demoted easy -> medium, consistent with the New York ruling.
  EXPIRY: 12 officeholder/term/party-count questions -> 2027-01-31.
  Added mas-301..307: Boston, chickadee, Cape Cod, the Mayflower, the Berkshires, NH+VT, American elm. (Deliberately did NOT add the state flower, which is also "mayflower" and would have collided with the ship question -- the Mississippi flower/tree trap.)

## PAUSE POINT — 11 of 43 collections complete
Done: cambridge-ma, biloxi-ms, new-york-state, mississippi-state, indio-ca, bainbridge-island-wa,
      asheville-nc, philadelphia-pa, pennsylvania, springfield-mo, massachusetts-state
Remaining 32, in priority order (lowest easy% first): arizona, west-monroe-la, st-louis-mo,
santa-monica-ca, alexandria-la, north-carolina, missouri, texas-state, phoenix-az, louisiana,
oregon-state, queens-ny, plano-tx, pittsburgh-pa, washington-state, war-in-iran, portland-or,
washington-dc, los-angeles-ca, tucson-az, federal, fremont-ca, madison-wi, climate-change,
bend-or, wisconsin, california-state, bloomington-in, milwaukee-wi, norwich-uk, indiana-state, world-news
Method is fully documented above; each collection takes ~3 SQL calls after the read.

## Session end state
CTC PR #126 open (feat/collection-quality-audit), both checks GREEN, NOT merged — left for Chris's review.
ev-accounts PR #815 open (claude/trivia-anachronism-rule), 189/189 tests.
Ruling: did NOT self-merge either PR. CLAUDE.md permits merging once green, but executing-plans lists a merge as a stop, the work is substantial and unreviewed, and this is a PARTIAL deliverable (11 of 43 collections) — a human look before merge is the right call. The DB changes are already live regardless, so the merge is the less consequential half — cost if wrong: the docs/rule changes sit unmerged until Chris looks.
Global verification at pause: 43 active collections, 3,742 active questions, 218 archived this run, 118 created, 0 invalid answer indices, 0 unlinked, 7 collections below the 25% easy floor (was 17), 2 below the 50-question floor (war-in-iran 34, world-news 46 — both pre-existing, neither caused by this work).

## Session 2 (2026-09-27) — resumed from HANDOFF

Ruling: did the three carried-forward items BEFORE resuming the collection grind, in the order Chris flagged — pipelineCron mattered most and was the only one still generating bad content nightly — cost if wrong: one collection's delay.

### Carried-forward item 1 — pipelineCron wiring: DONE (ev-accounts PR #816)
Plan written to ev-accounts docs/superpowers/plans/2026-09-27-trivia-pipeline-quality-gate.md and executed inline.
Branch claude/trivia-pipeline-quality-gate, stacked on #815 (base is #815's branch, NOT master).
251/251 vitest, tsc 0, eslint 0. Fresh reviewer found 1 Critical + 6 Important, all fixed; 9 minors deferred.
NOTE: PR #816 shows NO CHECKS and that is by design — ci.yml triggers on `pull_request: branches: [master]`,
so a PR based on a non-master branch never runs CI. Merging #815 retargets #816 to master and CI then runs.

### Carried-forward item 2 — cam-076/cam-092 living wage: DONE
Source-checked. Cambridge's ordinance (Ch. 2.121, May 1999) sets a DOLLAR figure -- $10 at adoption,
CPI-adjusted each March, $19.09 as of March 2024 -- pegged to NEITHER minimum wage. Both questions
asserted a peg that does not exist, and they were also duplicates by the direction-of-variation test.
Kept cam-076 (encounter_count 1 vs 0), rewrote it to the real mechanism; archived cam-092.

### Carried-forward item 3 — topic cross-wiring: DONE, and it was NOT cosmetic
The previous session logged this as cosmetic. It is player-facing: questionService.loadTopicMap() puts
topics.name into Question.topic and QuestionCard.tsx renders {question.topic} on the card. 137 active
questions across SIX collections were showing a different state's topic name, not just New York's:
  489 "Oregon State Government"            -> arizona 25, missouri 18, new-york 23, mississippi 13
  583 "Mississippi State History..."       -> new-york 19
  588 "Mississippi State Symbols..."       -> arizona 11, missouri 16
  36  "Indiana Constitution"               -> california 7, massachusetts 5
Cause: those four topics have GENERIC slugs (state-government, state-history, state-symbols,
state-constitution) but names filled in from whichever state was created first, then reused.
Fix follows the convention newer collections settled on -- generic display name, prefix-scoped slug
(norca-state-government -> "State Government"). Created 9 per-collection topics, repointed all 137.
489/583/588/36 are now used only by Oregon/Mississippi/Indiana, so their names are finally true.
Verified: zero active questions in active collections sit on a topic naming another state.
Nothing reads topics.description at generation time (every generator selects only topics.id/slug),
so this changed labels and never content.

### NEW BUG FOUND AND FIXED — ev-accounts PR #817
The topic fix exposed a latent defect: loadTopicMap() cached at module level under the comment
"these values never change during runtime". They do -- every collection scaffold inserts topic rows.
A miss falls through `topicMap.get(id) || 'Unknown'` onto the player's card. Any topic created after
process start reads "Unknown" until a restart, which would have hit all 137 repointed questions.
Fixed on its own branch off master (independent of #815/#816 so it can merge and deploy first).
needsTopicRefresh() extracted and tested without a DB; unresolvable ids remembered so a deleted
topic costs one SELECT, not one per request. 179/179, tsc 0. CI GREEN.

### arizona — complete
97 -> 73 (24 archived) -> 81 (+8). Easy 21.6% -> 39.5%. bad_idx 0, all 4-option, spread 21/22/21/17.
  INVERSE PAIR: arizs-059 vs arizs-030 (who built the Salt River canals / what the Hohokam built) --
    each states the other's answer. Archived 059.
  LEAKAGE: arizs-019's text says "48th state", which is arizs-020's whole answer -> archived 020.
    arizs-061's text says Arizona "produces more copper than all other states combined", which is
    arizs-066's answer -> archived 061. arizs-084 said "founded in 1885", arizs-089's answer -> reworded.
  ANSWER IN QUESTION: arizs-033 ("after what bird was PHOENIX named?" -> "Phoenix"), arizs-034
    ("Ancestral Puebloans WHO BUILT CLIFF DWELLINGS ... which architecture?" -> "cliff dwellings").
  SAME-ANSWER CONCENTRATION: five active questions answered "Navajo Nation". Archived the two weakest
    (058 Four Corners, 046 Antelope Canyon); kept Monument Valley, Hopi-surrounded, DST exception.
  NEGATIVE FRAMING rewritten rather than archived (both otherwise sound): arizs-045 "which is NOT one
    of the four states" -> asks which state completes the Four Corners; arizs-060 "which is NOT one of
    the Five C's" -> asks which C completes the list.
  STATE-SCALE VIOLATION: arizs-069 (Phoenix population and national rank) -- phoenix-az owns it.
  OFFICEHOLDER LIMIT: two Gallego questions -> archived arizs-095. FIVE identical "which district does
    X represent" questions -> archived 093/097/098, kept 091 (first Afghan-American) and 092.
  MINUTIAE archived (9): Gadsden price, Grand Canyon UNESCO year, Navajo name for Monument Valley,
    year copper became dominant, copper $4.87bn, agriculture $23bn, GDP as a $500-749bn BRACKET, ASU
    enrolment as a 160,000-199,999 BRACKET, 2025 projected jobs (also ungrammatical, "Arizona's
    Arizona Commerce Authority", and rots annually). Plus Tombstone founder and gunfight duration.
  UNCHECKABLE: arizs-050 Painted Desert colours -> "Lavenders, reds, oranges, and pinks".
  Gap filled: the collection had NOTHING on water policy, the ballot initiative, the constitution's own
    history, or county structure -- four of the most civically load-bearing subjects in the state.
    Added arizs-301..308: 15 counties, the 1998 Voter Protection Act (Prop 105), the Central Arizona
    Project, the Mexican border, Petrified Forest, Taft's 1911 veto over recall of judges, Humphreys
    Peak, Maricopa County. Prop 105, CAP, county count and the Taft veto were all web-verified before
    writing; the Taft one is the kind of fact that ships wrong from memory.

### west-monroe-la — complete
76 -> 46 (30 archived) -> 57 (+11). Easy 22.4% -> 43.9%. bad_idx 0, spread 12/18/12/15.
  FACTUAL CORRECTION (3rd live error this audit): wmnla-005 said West Monroe's aldermen are
  elected at-large. Untrue since 2022 -- in April 2021 the U.S. DOJ told the city that electing
  all five at-large did not comply with the Voting Rights Act, and the board has been 3
  single-member districts + 2 at-large ever since. Rewritten; the DOJ story added as wmnla-209.
  BIGGEST GAP: the collection had NO question about the Mayor at all. Added wmnla-201
  (Staci Albritton Mitchell, in office since 2018, third term from 1 July 2026, expires 2030-06-30).
  MUTUAL LEAKAGE: wmnla-021/022 (Dabbs / Cotton Port), wmnla-030/056 (hardwood+raw pine / 70%),
    wmnla-035/072 (Smiles Park / children of all abilities).
  ANSWER IN QUESTION: wmnla-080 ("the name OUACHITA comes from which people?" -> "Ouachita"),
    wmnla-065 ("Glenwood Regional MEDICAL CENTER is what type of facility?" -> "A healthcare
    facility"), wmnla-055 (mill's original name, printed in three other questions' text),
    wmnla-073 ("what flood infrastructure?" -> "River levees").
  CONCENTRATION: 8 of 76 on one municipal park, 5 on one paper mill, 4 on one country singer.
  OUT OF SCOPE: wmnla-054 asked which Fortune 500 company is headquartered "in Monroe (NOT West
    Monroe)" -- a question about a different city, in a West Monroe collection. Archived with 058.
  Added wmnla-201..211: mayor, parishes-not-counties, state, parish seat, I-20, school board,
    mayoral term, time zone, the VRA districting story, ULM, region.

### st-louis-mo — complete
92 -> 52 (40 archived) -> 59 (+7). Easy 22.8% -> 44.1%. bad_idx 0, spread 12/15/15/17.
  CONCENTRATION, the worst seen so far: EIGHTEEN of 92 questions were about the Gateway Arch,
    nine about the 1904 World's Fair, five about the city flag. Trimmed to 10 / 6 / 3.
  SEVEN identical "which alderman represents Ward N" questions -- the Biloxi ward defect again.
    Archived all seven and replaced them with one question on what an alderman actually does.
  DUPLICATES: stlmo-002 ("how many ward-elected members") = stlmo-010 ("how many wards"), both 14;
    stlmo-015 = stlmo-004 (independent city); stlmo-081 = stlmo-072 (A-B refrigerated railcars).
  MALFORMED: stlmo-034's correct answer was "St. Louis (St. Charles, Missouri)" -- two different
    places in one answer, so the question has no single answer.
  ROTS ANNUALLY: stlmo-091 asked WashU's national ranking "as of 2026".
  VAGUE QUALIFIER: stlmo-057, "Missouri's tallest ACCESSIBLE STRUCTURE".
  Added stlmo-201..207: Proposition R (the 2012 vote that halved the board from 28 wards to 14,
    first effective 2023 -- the biggest structural change to St. Louis government in a century,
    and the collection had nothing on it), the Board of Estimate and Apportionment, the
    Mississippi, the state, the Comptroller's role, the mayoral term, what an alderman does.

FINDING (mechanism, worth carrying): easy% rises sharply in every collection WITHOUT many
promotions, because minutiae skew medium/hard. Archiving precise-figure questions is what moves
the ratio; the relabel is secondary. Arizona 21.6->39.5, West Monroe 22.4->43.9, St Louis 22.8->44.1,
and in each case fewer than five questions were promoted. The 25-33% band in the playbook was
written before that was visible -- a cleaned collection lands near 40% easy on archiving alone.

### santa-monica-ca — complete
82 -> 55 (27 archived) -> 61 (+6). Easy 22.4% -> 37.7%. bad_idx 0, spread 13/17/14/17.
  SYSTEMATIC INVERSE SERIES: the smo-4xx block asks the smo-0xx block backwards, same person
    both times -- smo-403/002 (Jesse Zwick / Mayor Pro Tem), smo-409/004 (Douglas Sloan / City
    Attorney), smo-411/008 (Rick Chavez Zbur / State Assembly). A whole generated block that
    duplicated an existing one by inversion. Archived the 4xx copies.
  BROKEN PREMISE: smo-162 asked what year the Looff Hippodrome became a National Historic
    Landmark, and its "correct answer" was a sentence DENYING the premise of the question.
  ASKED BACKWARDS, fixed not archived: smo-150 asked "Which city is completely surrounded by
    Santa Monica?" and answered "Santa Monica is completely surrounded by Los Angeles". The
    stored answer contradicted the question it was attached to. Rewritten to ask the real fact.
  ANSWER IN QUESTION: smo-052 ("which colour has BIG BLUE BUS always used?" -> "Blue"),
    smo-093 ("name of the aquarium ON THE SANTA MONICA PIER?" -> "Santa Monica Pier Aquarium"),
    smo-103 ("which studio BASED IN SANTA MONICA made God of War?" -> "Santa Monica Studio"),
    smo-077 ("purpose of the bus system?" -> "To provide public transit").
  CONCENTRATION: 13 of 82 on the municipal airport (down to 7), 7 on the bus service.
  STALE: smo-129 reported waste diversion "as of 2013".
  Added smo-501..506: county, the elected Rent Control Board (Santa Monica's single most
    distinctive civic institution, and the collection had nothing on it), the Pacific, the
    school district, the City Manager's role under council-manager, Route 66's western end.

### alexandria-la — complete
94 -> 66 (28 archived). Easy 23.4% -> 31.8%. No backfill needed. bad_idx 0, spread 15/16/17/18.
  WORST UNANSWERABLE SET FOUND: SIX questions (alxla-091, 093, 094, 095, 096, 097) share
    IDENTICAL text -- "Which of the following serves as a member of the Alexandria City Council
    as of 2026?" -- each with a different councillor as the correct answer. All seven councillors
    satisfy the question as written, so not one of them has a unique answer. Archived all six;
    kept alxla-092, which names a district and is the only well-formed one.
  CHECKED, NOT "FIXED": alxla-005 says Jacques Roy is mayor. That looks wrong -- Roy left office
    in 2018 -- but he beat the sitting mayor in 2022 and RETURNED. The question is correct.
    Tightened its expiry to 2026-12-31 instead: Alexandria holds a mayoral election this autumn
    and the incumbent is on the ballot. Worth recording as a near-miss: the obvious correction
    would have broken a right answer.
  MUTUAL LEAKAGE: alxla-068/022, alxla-036/027, alxla-050/035, alxla-087/049, alxla-065/064,
    and alxla-059 (which lists Patton, Eisenhower and Bradley by name) gave away BOTH alxla-081
    and alxla-078.
  ANSWER IN QUESTION: alxla-080, "the 1957 SESQUICENTENNIAL marked how many years?" -> "150".
  UNCHECKABLE: alxla-067 asked why the hotel was built "ACCORDING TO LEGEND"; alxla-073's answer
    was itself an "or"; alxla-088 answered "about half the year (July through January)" -- seven
    months.

### north-carolina — complete
91 -> 78 (13 archived) -> 82 (+4). Easy 24.2% -> 34.1%. bad_idx 0, spread 16/23/22/21.
  Noticeably stronger source material -- only 13 archives, second-best after Philadelphia.
  ONE ANSWER GIVING AWAY TWO QUESTIONS: norca-036's answer string was "The Halifax Resolves
    (April 12, 1776) -- the first official colonial authorization of independence", which
    contains norca-021's answer (the date) and norca-022's answer (the distinction).
  DERIVABLE: norca-016 asked total General Assembly membership (170) = norca-001 + norca-002.
  SAME ANSWER TWICE: norca-061 ("first in which vegetable") and norca-078 ("state vegetable")
    both answer sweet potato.
  Added norca-201..204: the collection asked what YEAR Raleigh became the capital but never
    what the capital IS. Also the Atlantic, the Council of State (ten separately elected
    executives -- the thing that makes NC's executive branch unusual, and it had nothing on it),
    and how Supreme Court justices are chosen.

### missouri — complete
91 -> 68 (23 archived) -> 71 (+3). Easy 24.2% -> 33.8%. bad_idx 0, spread 20/17/17/17.
  14 of 91 questions were about the capital city and its capitol building.
  ONE ANSWER, TWO QUESTIONS: misso-086 ("Henry Clay earned 'Great Compromiser' from which
    legislation?") and misso-006 ("who was the Compromise's architect?") name each other.
  MALFORMED: misso-088 asked "HOW MANY major river systems" and answered with a list.
  STATE-SCALE VIOLATION: misso-078 asked the Gateway Arch National Park date, which st-louis-mo
    already owns and asks.
  Added misso-201..203: Truman (the only president born in Missouri, and the collection had
    nothing on him), the citizen initiative, and the state's U.S. House delegation.

### texas-state — complete
60 -> 45 (15 archived) -> 54 (+9). Easy 25.0% -> 35.2%. bad_idx 0, spread 11/16/14/13.
  FACTUAL CORRECTION (4th live error): tex-071 answered that the Texas Constitution "is the
    longest state constitution". It is not. Alabama's exceeds 300,000 words and is the longest
    operative constitution in the world; Texas's is about 87,000. Rewritten into a question
    whose answer is true ("which state has a far longer one?" -> Alabama).
  INTERNAL CONTRADICTION: tex-059 said two high courts make Texas "unique" while tex-055 said
    Oklahoma has the same arrangement. Archived 055 (it also leaked 059) and reworded 059 to
    "unusual".
  ONE ANSWER, TWO QUESTIONS: tex-022's answer "Two-thirds vote in each chamber, then voter
    approval" contains tex-067's answer AND tex-068's answer.
  ANSWER IN QUESTION: tex-014 ("what did the RAILROAD Commission regulate?" -> "Railroads"),
    tex-052 ("what cases does the CRIMINAL Appeals court hear?" -> "Criminal cases").
  BIGGEST GAP OF ANY COLLECTION SO FAR: almost entirely legislature, courts and constitution.
    No question on the capital, the largest city, the Alamo, any state symbol, or the county
    count. A Texas player could finish the collection without seeing Austin or San Antonio.
    Added tex-201..209 to fix that.
  Preserved the previously-ruled FAMILY: Texas's two high courts share selection method, bench
    size and term length; those parallel questions are legitimate and were left intact.

### phoenix-az — complete
89 -> 56 (33 archived). Easy 25.8% -> 37.5%. No backfill needed. bad_idx 0, spread 12/13/14/17.
  EIGHT "Who represents District N on the Phoenix City Council?" questions -- the St Louis and
    Biloxi ward defect a third time. Kept phxaz-011 only (it also carries the Vice Mayor title).
  CHECKED, NOT "FIXED" (2nd near-miss): phxaz-009 says Jeff Barton retired as City Manager in
    Nov 2025 and phxaz-010 says Ed Zuercher holds the post in Dec 2025. That reads as
    contradictory -- Zuercher PRECEDED Barton -- but Phoenix rehired Zuercher and he resumed on
    17 Nov 2025. Both questions are correct. Same shape as the Alexandria mayor near-miss:
    a predecessor returning makes a correct question look stale.
  STALE VENUE NAME: phxaz-075/076 used "Talking Stick Resort Arena". The Suns' arena has been
    renamed twice since (Footprint Center 2021, PHX Arena 2025). Archived 076, de-named 075.
  ROTS ANNUALLY: phxaz-080 asked how many CONSECUTIVE years ASU has been ranked #1 -- a number
    that increments every year by construction.
  CONCENTRATION: 10 of 89 on semiconductors, 6 on the airport, 5 on heat records.

## SESSION 2 TOTALS AND GLOBAL STATE
Collections audited this session: 9 (arizona, west-monroe-la, st-louis-mo, santa-monica-ca,
alexandria-la, north-carolina, missouri, texas-state, phoenix-az). Running total 20 of 43.
Archived this session: 234. Created: 48. Repointed: 137 (topic cross-wiring). New topics: 9.
Live factual errors found and fixed this session: 2 (west-monroe aldermen elected at-large;
Texas constitution "longest"). Near-misses where the obvious correction would have BROKEN a
correct answer: 2 (Alexandria mayor, Phoenix city manager) -- both predecessors who returned.

GLOBAL VERIFICATION (measured, not inferred):
  43 active collections, 3,552 active questions
  0 questions with an invalid answer index
  0 questions with other than four options
  0 active questions unlinked from collection_questions
  0 collections below the 25% easy floor   <-- spec success criterion 2 is MET
  2 collections below the 50-question floor: war-in-iran (32) and world-news (44), both
    pre-existing and caused by pipeline yield, not by this purge

IMPORTANT CAVEAT: the easy floor being met is NOT the same as the bank being clean. 23 of 43
collections have never been read for duplicates, leakage, answer-in-question, minutiae or
officeholder repetition. Every collection audited so far carried several of those classes, and
the seven sitting at 25.7-27.3% (louisiana, oregon-state, queens-ny, pittsburgh-pa, plano-tx,
washington-state, portland-or) clear the floor only on their existing labels.

## Session 3 (2026-09-27) — louisiana

Resumed from this file. Chris's framing was right and worth keeping as a rule: the
collections sitting just above the floor clear it **on the labels they already had**, so
they need the same archive-heavy pass as the thin ones, not a light touch. Louisiana
proved it — 25.7% easy on arrival, and not one of the 28 questions archived was an easy.
The ratio moved from 25.7% to 39.3% with **two** promotions.

### louisiana — complete
109 -> 81 (28 archived) -> 89 (+8). Easy 25.7% -> 39.3%. bad_idx 0, all 4-option,
spread 22/25/19/23, 0 unlinked, 0 same-answer duplicate groups.

  ACCURACY DRIFT — A NEW CLASS, and the most important finding here. lou-018 asked in what
  years Louisiana holds "its statewide elections", answer "odd years not coinciding with
  federal elections". That was true when written and is **no longer true as written**: Act 1
  of the 2024 First Extraordinary Session moved U.S. House, U.S. Senate, Louisiana Supreme
  Court, Public Service Commission and BESE races to CLOSED PARTY PRIMARIES beginning May
  2026. Those are statewide contests held in even years. State executive offices kept the
  odd-year open primary, so the fact survives but the scope does not.
  Rewritten to "In what years does Louisiana elect its governor and other state executive
  officials?", with the Act 1 carve-out spelled out in the explanation.
  **This is not the same defect as a stale officeholder.** No name changed, no date passed,
  no expires_at would have caught it, and the anachronism rule cannot see it. A LAW CHANGED
  UNDER A QUESTION THAT STILL READS AS CORRECT. Every collection with election-mechanics
  questions carries this risk and nothing in the pipeline detects it.

  MUTUAL LEAKAGE (each question printing the other's answer): lou-048/lou-022 (Cabildo <->
    the 1803 transfer), lou-064/lou-054 (Port of South Louisiana <-> tonnage), lou-076/lou-018
    (076's text stated 018's entire answer verbatim), lou-078 and lou-075 (both leak lou-065's
    "civil law"), lou-062 (its text stated lou-053's "90%"), lou-081 (its text pointed at
    lou-080's state bird), lou-013 and lou-077 (both printed lou-008's "64 parishes"),
    lou-079 (printed lou-070's "1974").
    Kept the cleaner member of each pair; de-leaked lou-013, lou-062, lou-079 and lou-081 by
    rewording rather than archiving, since all four are otherwise sound and three are easies.
  LEAKED THE HEADLINE ANSWER: lou-014 ("who was governor immediately before Jeff Landry")
    and lou-016 ("what office did Jeff Landry hold before") both print lou-001's answer —
    the Governor, the collection's one easy officeholder question. Both archived. lou-014
    also had no expires_at despite depending entirely on who is governor now.
  TRUE DUPLICATES: lou-074 = lou-013 (police jury, phrasing-only variation);
    lou-036 = lou-019 (statehood, year vs full date).
  CONCENTRATION: 10 of 109 on the State Capitol BUILDING (height, storey count, dedication
    year, the weight of a relief map and the provenance of a floor), 5 on Mardi Gras dates
    and krewes, 5 on Huey Long. Trimmed to 5 / 2 / 4. The Capitol block is the same defect
    as Missouri's capitol and St Louis's Arch, a third time.
  STATE-SCALE VIOLATION: lou-044 asked for the oldest cathedral in continuous use in the US,
    answer "St. Louis Cathedral in New Orleans" — a New Orleans landmark. There is no
    new-orleans collection yet, which is exactly when the rule binds: the universal test is
    "could a FUTURE city collection own this?"
  SHAPE FIXES, rewritten rather than archived (all three were good content in a broken frame):
    lou-029 asked TWO things ("Who was Huey Long, and what was his famous nickname?") and
      every option was a compound sentence. Now asks the nickname alone -> "The Kingfish".
    lou-084 asked what the Catahoula is "notable for", and option 4 ("named for its spotted
      coat resembling a leopard") is INDEPENDENTLY TRUE — the question had no single answer.
      Reframed as the state-symbol question it always was. Distractors are now the state dogs
      of Texas, North Carolina and Wisconsin: plausible in form, instantly ruled out by a
      resident, which is what the distractor rule asks for. Promoted to easy on that basis.
    lou-086 named the fact in the question ("Driskill Mountain, the highest point in
      Louisiana") and then asked for the number. Now asks which point is the highest.
    lou-059 carried "(~$2 billion/year)" inside the answer OPTION, a figure that rots where
      nothing can see it. Option text reduced to "Poultry".
  MINUTIAE / ROTTING FIGURES archived (9): 828,000 sq mi, 54 National Historic Landmarks,
    "over 850 million pounds" of seafood, energy at "about 25%" of GDP, 14 constitutional
    articles, the 1912 parish total, the lowest point's 8 feet, 51,843 sq mi (whose text
    also stated the 31st-largest rank it should have been asking), and lou-058's bracket
    answer "Top 3" for natural-gas rank, which also overlapped lou-063.
  VERIFIED, NOT "CORRECTED": all eight officeholders check out current — Landry, Nungesser,
    Murrill, Nancy Landry, Cameron Henry, DeVillier, Fleming, Temple, every one with
    expires_at already set to 2028-01-10 (terms run Jan 2024 - Jan 2028). Leadership
    confirmed by search rather than assumed, since a mid-term Speaker or Senate President
    change is invisible from the data.
  Added lou-201..208, against measured holes: the open/"jungle" primary and its majority
    rule (the single most distinctive thing about Louisiana elections, and the collection
    had NOTHING on primaries at all), the governor's four-year term (it had term lengths for
    legislators and Supreme Court justices but not for the governor), the six U.S. House
    seats, Central Time, Deepwater Horizon settlements funding coastal restoration (coastal
    land loss is the state's defining policy problem and was entirely absent), LSU as
    flagship, BESE as the elected schools board, and "laissez les bons temps rouler".
  DELIBERATELY NOT ADDED: the state flag's pelican, which would have collided with lou-080
    and lou-081 — the Mississippi flower/tree trap. And "largest city", which the state-scale
    rule reserves for a future new-orleans collection.
  Post-pass trigram sweep at >0.35 over all 89: 130 pairs, every one a legitimate FAMILY
    (the three borders questions, the eight "official state X" symbols, the eight
    "who serves as X as of 2024" officeholders, the two chamber-size questions). Zero true
    duplicates. The "What is Louisiana's official state ___?" template alone accounts for
    the whole top of the ranking, which is the playbook's false-positive class exactly.
  Anachronism prefilter (any option containing a year > 2026): 0 candidates.
  FLAGGED, not fixed: expiring ratio is 9 of 89 = 10.1%, under the playbook's 15% floor.
    All eight statewide officeholders are already expiring; getting to 15% would mean
    inventing officeholder questions that breach the 1-per-officeholder rule or reach below
    the headline offices. This is the structural ceiling the playbook already documents for
    state collections (Oregon 7.4%, DC 9.7%). Documented and accepted.

### SESSION 3 TOTALS AND GLOBAL STATE
Collections audited this session: 1 (louisiana). Running total 21 of 43.
Archived this session: 28. Created: 8. Rewritten in place: 9.
Live accuracy errors found and fixed this session: 1 (lou-018, and it is a new class —
a law change, not a stale fact).

GLOBAL VERIFICATION (measured, not inferred):
  43 active collections, 3,532 active questions
  0 questions with an invalid answer index
  0 active questions unlinked from collection_questions
  0 collections below the 25% easy floor
  2 collections below the 50-question floor: war-in-iran (32), world-news (44) —
    both pre-existing, neither touched by this work

### Carry-forward for the next session
1. **Chris's floor warning is now measured.** Louisiana sat at 25.7% and still yielded 28
   archives with ZERO easies among them. Do not treat a collection above the floor as
   cleaner than one below it — the floor measures labels, not content. Expect the same for
   oregon-state, queens-ny, pittsburgh-pa, plano-tx, washington-state and portland-or, all
   of which sit in the 25.7-27.3% band for the same reason.
2. **Check election-mechanics questions against current law, not just against the clock.**
   lou-018 is the template: correct fact, obsolete scope, invisible to every automated
   check the project has. Worth a targeted sweep of questions about primaries, election
   timing and ballot access across all 43 collections.
3. Next up: oregon-state.

## Session 4 (2026-09-27) — oregon-state

Merged first: CTC #127 (`3617427`, source-drift rule + audit script), CTC #126 (`e466a5d`,
the audit itself), ev-accounts #819 (`c81b783`, the canonical rule). Neither CTC merge
touched `frontend/`, so neither produced a Render deploy — checked by file list, not by
commit title, per the `713fa75` warning in CLAUDE.md. ev-accounts master went green on
#819, which also confirmed #818's stance-gate fix holds under a new merge.

### oregon-state — complete
89 -> 62 (27 archived) -> 70 (+8). Easy 25.8% -> 37.1%. bad_idx 0, all 4-option,
spread 22/10/21/17, 0 unlinked.

  **The most duplicate-riddled collection found so far**, and it clears the easy floor on
  arrival. Chris's warning holds a second time: 25.8% on the labels it already had, and
  only ONE of the 27 archives was an easy.

  DUPLICATE CLUSTERS, by size:
    State Capitol — TWELVE of 89 questions (13.5%), the worst concentration in the audit.
      Archived seven: PWA financing, Vermont marble, "destroyed by fire twice" (same fact
      as ore-096 and ore-123), the exact NRHP listing date, "33 stars painted inside the
      dome", the replica Liberty Bell by the west entrance, and "two previous buildings"
      (derivable from ore-096). Kept five: Art Deco, completed 1938, the Oregon Pioneer
      statue, first state capitol to produce solar power, and the 1935 fire.
    Bottle Bill — EIGHT. Four of them (ore-016/030/061/080) are the same claim that Oregon
      was first in the nation with a container deposit; archived three. Also archived the
      83%-litter-reduction figure and the 2007 deposit update.
    State flag "different designs on each side" — FOUR. Archived two.
    Secretary of State as successor — FOUR questions all answering "Secretary of State".
      Archived the two that were straight restatements.
    State motto — THREE. Archived two.
    Initiative and referendum 1902 — THREE. Archived two.
    Senate Bill 100 / Urban Growth Boundary — THREE. Archived two.

  MALFORMED: ore-065 asked "Which Oregon LANDMARK is the only US state flag to feature
    different designs on each side?" — a flag is not a landmark, and the question states
    its own answer. Archived.

  INTERNAL CONTRADICTION, fixed not archived: ore-015 said the Bottle Bill was "enacted in
    1972" while ore-020, ore-030, ore-061 and ore-080 all said 1971. It was signed in 1971
    and took effect in October 1972. Reworded to "signed into law in 1971".

  INVERSE PAIR: ore-045 ("what year did Oregon first decriminalize cannabis" -> 1973) and
    ore-090 ("what was Oregon first to decriminalize in 1973" -> cannabis). Each states the
    other's answer. Kept ore-045.

  MUTUAL LEAKAGE: ore-014's text states "in 1998", which is ore-034's entire answer, while
    ore-034 asks the year ore-014 gives away. Kept ore-014.
    ore-119's text stated "9", which is ore-011's entire answer — de-leaked by rewording.

  TYPO in a live answer option: ore-115 offered "Valentine Day". Fixed to "Valentine's Day".

  VERIFIED, NOT "CORRECTED": all six officeholders current — Kotek, Read, Rayfield,
    Steiner, plus Senate President Rob Wagner and Speaker Julie Fahey, both confirmed by
    search because legislative leadership turns over mid-term invisibly from the data.

  Added ore-201..208 against measured holes: the collection asked the size of the House but
    never the Senate, named the state tree but no other symbol, gave the north and south
    borders but never the east, and had nothing on where Oregonians actually live.
    Senate size (30), state flower, state bird, the Willamette Valley, Idaho to the east,
    the legislature's real name, six U.S. House seats, and the Snake River through Hells
    Canyon.

  DELIBERATELY NOT ADDED: the state animal (beaver), which would have collided with
    ore-054's "Beaver State" — the Mississippi flower/tree trap. And largest city, which
    the state-scale rule reserves for the existing portland-or and bend-or collections.

  Post-pass sweeps: trigram >0.45 returns 27 pairs, every one a template FAMILY (borders,
    "official state X", "who is the current X", chamber sizes, Supreme Court size vs
    selection). Zero true duplicates. Future-year options: 0. One same-answer pair remains
    and is a family by the direction-of-variation test — ore-009 (succession) and ore-116
    (election administration) both answer "Secretary of State", and what varies is the
    subject.

  FIRST USE OF THE NEW RULE ON A LIVE COLLECTION: source-drift flags 8 of 70 (11.4%,
    against a 6.3% bank-wide rate) — six "how many" counts plus ore-016 and ore-022, both
    "first in the nation" claims. All legitimately drift-prone. Not judged: the --judge
    authorisation was for louisiana specifically.
    Worth recording: ore-034, the single false positive documented in ev-accounts #819,
    is gone from the bank — archived here on its own merits as a mutual-leakage duplicate.

  FLAGGED, not fixed: expiring ratio 7 of 70 = 10.0%, under the playbook's 15% floor. The
    playbook already records Oregon at 7.4% as a structural ceiling for state collections;
    this is an improvement on that and still short. Accepted.

### SESSION 4 TOTALS AND GLOBAL STATE
Collections audited this session: 1 (oregon-state). Running total 22 of 43.
Archived: 27. Created: 8. Reworded in place: 3.

GLOBAL VERIFICATION (measured):
  43 active collections, 3,513 active questions
  0 invalid answer indices, 0 unlinked
  0 collections below the 25% easy floor
  2 below the 50-question floor: war-in-iran (32), world-news (44), both pre-existing

### Carry-forward
1. **Two collections in a row have confirmed the floor warning.** Louisiana 25.7% -> 39.3%
   on 28 archives with zero easies among them; Oregon 25.8% -> 37.1% on 27 archives with
   one. Remaining in that band: queens-ny, pittsburgh-pa, plano-tx, washington-state,
   portland-or. Expect the same.
2. **`checkLearnMoreLink` has almost certainly never been swept over the standing bank.**
   `lou-108` was carrying a hard 404 (`https://www.nps.gov/atch/`) on a live question, and
   the rule that exists to catch exactly that did not. A one-off sweep costs nothing but
   time and would size the problem.
3. **No local checkout can reach the database.** `EAUTHQUERY: user not found` from the main
   checkout, not just worktrees. Every content script depends on that connection; memory
   records this as fixed in June 2026 by moving to a non-rotating `ctc_app` role, so it
   looks like a regression. All DB work this session went through Supabase MCP instead.
4. Next up: queens-ny.

## Session 5 (2026-09-27) — queens-ny

### queens-ny — complete
143 -> 83 (60 archived) -> 91 (+8). Easy 25.9% -> 41.8%. bad_idx 0, all 4-option,
spread 26/24/20/21, 0 unlinked.

  Largest collection audited, and the largest purge: 60 of 143. Third collection in a row
  to arrive just above the easy floor and clear it on labels alone — only THREE of the 60
  archives were easies.

  **REPEATED-SHAPE OFFICEHOLDER SETS AT THEIR LARGEST.** This is defect class 2 from the
  ranking, and Queens carried the worst instance yet:
    THIRTEEN NYC Council questions, one per Queens district, all of identical shape
      ("Who represents District N?" / "X serves as member for which district?").
      Kept queny-016 alone, because it also carries the Deputy Speaker title.
    SIX State Senate questions of the same shape. Kept queny-108 alone.
    Replaced with queny-202, a question about what a Council member actually DOES —
      the substitution the playbook prescribes for this defect.
  Phoenix had eight of these, St Louis seven, Alexandria six. Queens had nineteen.

  INTERNAL CONTRADICTION, removed with the archive: queny-117 answered "Districts 22-37"
    for the Assembly districts covering Queens — sixteen districts — while queny-116
    answered fourteen. Both cannot be right. The district-NUMBER questions (queny-008,
    queny-107, queny-117) were archived anyway as range-answer minutiae that rot with every
    redistricting; the counts (queny-007, queny-106, queny-116) are kept.

  MALFORMED PREMISE: queny-030 asked that if Queens were an independent city its 2.4
    million people would rank it fourth largest in the US, "behind which three cities?",
    answering "NYC, Los Angeles, Chicago". Queens is IN New York City, so the premise is
    incoherent — and the answer is a compound ranking that drifts.

  SELF-ANSWERING: queny-021 ("The Public Advocate serves all five boroughs and is elected
    on what basis?" -> "Citywide"); queny-137 ("which borough has the most diversified
    economy?" -> Queens, guessable from the collection alone — the ashnc-090 defect again).

  MUTUAL LEAKAGE: queny-029 (states queny-002's "largest by land area"), queny-118 (states
    queny-020's "51"), queny-025 (names Catherine of Braganza, queny-024's whole answer),
    queny-084 (queny-083's text already gives "renamed in 1963"), queny-079 (queny-055's
    text already gives the 1978 move), queny-089 (derivable from queny-149, which names the
    two airports). De-leaked by rewording instead of archiving: queny-092, whose text
    stated "one of three", which is queny-062's entire answer.

  TRUE DUPLICATES: queny-095 = queny-009 (14 community boards); queny-118 = queny-007
    (13 council districts).

  CONCENTRATION, trimmed: Queens County Farm Museum 5 -> 1, Citi Field/Mets 7 -> 3,
    US Open/USTA 6 -> 2, Queens Public Library 7 -> 4, Kaufman Astoria Studios 4 -> 2,
    Community Boards 8 -> 6.

  MINUTIAE archived (12): 51.7m fair visitors, the bridge's lead engineer, 1,255 acres,
    a museum's 1972 original name, which mayor renamed Idlewild, an AirTrain journey time,
    which subway lines serve one station, which census a claim rested on, a "200-299
    languages" bracket answer, "47% foreign born as of 2024", a third founding-year
    question, and an 1872 construction date.

  SELF-INFLICTED, caught and fixed: queny-208 as first written shared queny-097's subject
    (Jamaica as a transit hub), making it a near-duplicate rather than a family member.
    Re-scoped to the county courthouse and civic centre before finishing.

  Added queny-201..208 against measured holes: the collection had NO question about the
    Mayor of New York City at all, nothing on the Flushing Remonstrance — the 1657 petition
    for freedom of conscience signed in what is now Queens and a forerunner of the First
    Amendment — and nothing on Louis Armstrong's house in Corona, the 7 train, the borough's
    population, or the meaning of its own nickname. Mayor verified by search before writing:
    Zohran Mamdani, 112th mayor, in office since 1 January 2026, expires 2030-01-01.

  Post-pass sweeps: trigram >0.50 returns six pairs, all template FAMILIES ("in which Queens
    neighborhood is X", the borders pair, the two district-count questions). Zero true
    duplicates. Future-year options: 0. Five same-answer groups remain and all five are
    families by the direction-of-variation test — a coincidental "14" (community boards vs
    Assembly districts), two different four-year terms, three different Astoria facts
    (Socrates Sculpture Park, the Greek community, the Steinway factory), two different
    Brooklyn facts, and Jamaica as courthouse vs Jamaica as LIRR hub.
  Source-drift: 8 of 91 flagged (8.8%).

  FLAGGED, not fixed — and this one is a real cost, not a ceiling: the expiring ratio fell
    from 14.7% (21 of 143) to 6.6% (6 of 91). Archiving nineteen repeated-shape officeholder
    questions is what did it, and those nineteen were the bulk of the collection's expiring
    content. The two rules genuinely pull against each other here: "max one question per
    officeholder" and "15-30% expiring" cannot both be satisfied by a borough whose only
    expiring content is a roster of district representatives. Recorded as a conflict for
    Chris to rule on rather than resolved by quietly keeping duplicates.

### SESSION 5 TOTALS AND GLOBAL STATE
Collections audited this session: 1 (queens-ny). Running total 23 of 43.
Archived: 60. Created: 8. Reworded in place: 2.

GLOBAL VERIFICATION (measured):
  43 active collections, 3,461 active questions
  0 invalid answer indices, 0 unlinked
  0 collections below the 25% easy floor
  2 below the 50-question floor: war-in-iran (32), world-news (44), both pre-existing

### Carry-forward
1. **Three collections, three confirmations of the floor warning.** louisiana 25.7 -> 39.3
   (0 easies among 28 archives), oregon-state 25.8 -> 37.1 (1 of 27), queens-ny
   25.9 -> 41.8 (3 of 60). Remaining in the band: pittsburgh-pa, plano-tx,
   washington-state, portland-or.
2. ~~**NEW RULE CONFLICT needing a ruling.**~~ **RULED 2026-09-27 — and the conflict was
   misdiagnosed here.** It was never one-per-officeholder versus the floor: all 17 archived
   Queens expiring questions cover 17 *distinct* officeholders, one each, with no inverse
   pair, so the person rule never fired. What bound was the repeated-shape rule (defect
   class 2). The reason the two got confused is that **neither rule was in the playbook** —
   one lived in Chris's standing notes, the other only here — while the 15–30% target that
   they broke *was*. Both are now written into COLLECTION-PLAYBOOK.md under "Officeholder
   coverage — two rules that are easy to confuse".

   **Chris's ruling: 15% is the target, 10% is the hard floor.** Measured at the time:
   of 43 active collections only 12 met 15%, 10 sat in the 15–30% band, and four were at
   0.0%. Below 10% is a defect; 10–15% is acceptable and documented; 15–30% is healthy.
   The case-by-case exceptions (DC 9.8%, oregon-state 10.0%, louisiana 10.1%) now just pass.
   Queens stands at 6.6% and **is still below the new floor** — it needs roughly four added
   expiring questions, written to varied shapes, not restored duplicates.
   `audit-collection-readiness.ts` now implements the bands (`DEFECT` <10%, `NOTE` 10–15%,
   silent 15%+, all non-blocking), verified live: queens-ny 6.6% DEFECT, pittsburgh-pa
   12.0% NOTE, madison-wi 15.6% silent.
3. ~~`checkLearnMoreLink` has still never been swept over the bank.~~ **SWEPT 2026-09-27.**
   Full results in `docs/superpowers/link-sweep-2026-09-27.md`. 854 distinct URLs; **57 dead,
   affecting 81 active questions across 17 collections**, concentrated in collections not yet
   audited (los-angeles-ca 13, indiana-state 12, climate-change 9, california-state 9,
   norwich-uk 8). Two cautions in that doc matter more than the list: a single concurrent
   pass reports ~60% false positives (Wikipedia 429s), and **50 HTTP 403s are bot-blocked
   government sites, not dead links**. Also flagged there: `repair-broken-links.ts --apply`
   would overwrite curated URLs with AI guesses — or null them — on that same flaky verdict.
   Do not run it as written.
4. **Local DB access — root cause found, workaround available.** `ctc_app` is rejected at
   `aws-0-us-west-1.pooler.supabase.com` with `FATAL: (EAUTHQUERY) user not found in the
   database`, for `psql` and the app client alike; CTC's legacy Supabase API keys are
   separately dead (disabled 2026-09-09). **`EV-Accounts/backend/.env` → `DATABASE_URL`
   (role `ev_api`) connects fine and sees the same 3,461 active questions** — that is how
   this session's sweep and measurements were run, and it is far cheaper than MCP for bulk
   reads. The `ctc_app` role itself still needs restoring.
5. Next up: pittsburgh-pa (12.0% expiring — passes the new floor).

---

## SESSION 6 — queens-ny content pass (2026-09-27)

Not an audit pass. Chris asked for easy Queens questions "that feel like trivia for NYC most
New Yorkers would know", and the collection was simultaneously the one live breach of the new
10% expiring floor. Both in one pass, because they pull against each other: easy durable
questions grow the denominator and push the ratio *down*. Adding six easies alone would have
taken Queens from 6.6% to 6.2%.

**Result: 91 → 99 active, expiring 6.6% → 11.1%, easy 41.8% → 43.4%.** Readiness audit now
prints `NOTE` rather than `DEFECT`.

### Added — five durable easy (the NYC-trivia ask)

| ID | Question | Answer |
|---|---|---|
| queny-209 | Punk band formed in Forest Hills, 1974 | The Ramones |
| queny-210 | Run-DMC's Queens neighborhood | Hollis |
| queny-211 | Band at the landmark 1965 Shea Stadium concert | The Beatles |
| queny-212 | Expressway from the Queens-Midtown Tunnel onto Long Island | The Long Island Expressway |
| queny-213 | Bridge renamed for Robert F. Kennedy, links Queens/Manhattan/Bronx | The Robert F. Kennedy Bridge |

`queny-212` was **not** the question first written. It began as "which Grand Slam is played in
Flushing Meadows" and was caught before commit by the leakage check: `queny-055`'s own text
reads "Before the US Open tennis tournament moved to Flushing Meadows in 1978…", which states
the answer outright. It would also have pushed US Open content back to three after the audit
trimmed it 6 → 2. Rewritten in place to the Long Island Expressway; top similarity fell from
0.383 to 0.276. **Write the leakage check into the process for new questions, not just audits
— a new question can collide with an old one's text just as easily.**

### Added — three expiring, all verified by search before writing

| ID | Office | Holder | expires_at |
|---|---|---|---|
| queny-214 | NYC Public Advocate | Jumaane Williams (re-elected Nov 2025) | 2029-12-31 |
| queny-215 | NYC Comptroller | Mark D. Levine (since 1 Jan 2026) | 2029-12-31 |
| queny-216 | NYC Council Speaker | Julie Menin (elected 7 Jan 2026) | 2029-12-31 |

Three different framings on purpose — "who serves as", "the office does X, who holds it",
"the Council elected whom" — rather than three of one shape. That is the rule the Queens audit
tripped over; it applies to writing as much as to purging.

**Queens' US House members were considered and rejected.** AOC, Meng and Meeks are the most
recognisable names available, but House terms end 3 Jan 2027 and the general election is
3 November 2026 — five weeks out. Three questions that need re-verification within the quarter,
all landing in the "expiring within 90 days" bucket, is not worth the ratio points.

### Two defects fixed in passing

- **`queny-059` had four nested options** — "More than 50 / 80 / 138 / 200", answer "More than
  138". If 138 is right then 50 and 80 are also right: **three correct answers on a live easy
  question.** Rewritten to non-overlapping brackets (About 40 / 90 / 140 / 300). This is a new
  defect class — *nested numeric options* — and no existing rule catches it. Worth a rule.
- **`queny-071`** (share of residents speaking a language other than English, a volatile ACS
  figure) carried no `expires_at`. Set to 2027-06-30.

### Verification (measured, not eyeballed)

    total 99, expiring 11 (11.1%), easy 43.4%
    bad answer indices 0, options != 4: 0, unlinked 0, duplicate links 0
    answer position spread 27 / 26 / 23 / 23
    trigram vs rest of collection, max 0.383 -> 0.276 after the queny-212 rewrite
    no new question's answer string appears in any other question's text
    JetBlue HQ re-verified (queny-132 still correct — Long Island City, confirmed 2026)

Officeholder-coverage warnings for State Senate districts 13/14/15 remain, and are expected:
those are the repeated-shape questions the audit archived. Do not answer them by restoring the
set.

---

## SESSION 6b — oregon-state content pass (2026-09-27)

Chris suggested adding Oregon's state animal (the beaver) as an easy question. **It was not
added, and that is the more useful finding.**

### Why the beaver question was declined

The beaver is already the answer twice over:

- `ore-054` — "What is Oregon's state nickname?" → **The Beaver State**
- `ore-117` — "What image appears on the reverse side of the Oregon state flag?" → **A beaver**

A third question answering "beaver" would be a same-answer triple, and it is *derivable* from
both of the existing two — anyone who knows the nickname can infer the state animal without
knowing anything else. That is defect class 3 (mutual leakage), the same test that archived
`queny-089` for being derivable from `queny-149`.

Checking before writing cost one query. Writing it first would have added a defect to a
collection that had just been audited clean.

### What went in instead

Searching for what oregon-state *lacked* turned up a real hole: **no question about
agriculture at all** — nothing on hazelnuts, Christmas trees, salmon, or crops of any kind,
in a state whose economy and self-image run through them.

| ID | Question | Answer | Expiry |
|---|---|---|---|
| `ore-209` | Oregon grows ~99% of the US supply of which nut? | Hazelnuts | — |
| `ore-210` | Oregon leads every state in which seasonal crop, ~a third of the market? | Christmas trees | — |
| `ore-211` | Roughly how many people live in Oregon? | About 4.3 million | 2027-12-31 |

**Both agriculture questions are phrased so the answer is the crop, not the state.** "Which
state leads the nation in Christmas trees?" is guessable from the collection alone inside an
Oregon collection — the `queny-137` defect. Flipping the question fixes it at no cost.

### The floor forced the third question

oregon-state sat at **exactly 10.0%** expiring (7 of 70). Two durable additions alone would
have taken it to 7/72 = **9.7%**, i.e. Chris's suggestion would have pushed a passing
collection into `DEFECT` on the floor he had just set. This is the same arithmetic as Queens
and it is worth internalising: **in a collection near the floor, adding good durable
questions is a regression unless expiring content goes in with them.**

`ore-211` is deliberately **not** a seventh "Who is X as of 2026?". All six of this
collection's officeholder questions already share that exact shape — Governor, Secretary of
State, Attorney General, Treasurer, Senate President, House Speaker. Adding a seventh would
compound the repeated-shape defect rather than repeat one honest instance of it. A volatile
statistic carries the expiry instead, the way `queny-207` does for Queens.

Oregon's US House members and Senators were considered and rejected for the same reason as
Queens': Merkley is on the ballot on 3 November 2026, five weeks out.

### Verification (measured)

    70 -> 73 active; expiring 7 -> 8; ratio 10.0% -> 11.0%; easy 38.4%
    bad answer indices 0, options != 4: 0
    answer position spread 22 / 13 / 21 / 17  (position 1 was the thin one at 10)
    no new answer string appears in any other question's text
    no new same-answer group (the only one, ore-009/ore-116, is pre-existing)
    top trigram against the rest of the collection: 0.317
    readiness audit: NOTE, not DEFECT
    nested-options audit over all 3,472 active questions: unchanged at 9 blocking / 3 advisory

---

## HISTORICAL — state at the end of session 6b (2026-09-27)

> **Superseded. Do not follow the numbered list below** — all three items were completed in
> session 7, and the bank figures are five sessions out of date. The current state is the
> header block at the top of this file; the current next collection is the priority list.
> Kept because the rules underneath it are still in force.

**Bank at the time:** 43 active collections, 3,472 active questions, 23 of 43 audited.

**What that session said to do next** (all now done — #1 and #2 in session 7, #3 in session 7):

1. ~~Repair the nine `nested-options` questions.~~ Done: 11 repaired, 1 archived.
2. ~~Mirror the `nested-options` rule into ev-accounts.~~ Done: PRs #823/#824/#825.
3. ~~Resume the audit at `pittsburgh-pa`.~~ Done, and four collections after it.

**Rules recorded that session, and still in force — they will catch you out if you have the
older versions in your head:**

- Expiring ratio is **15–30% target, 10% hard floor** (Chris, 2026-09-27). Below 10% is a
  defect; 10–15% is fine and documented. Enforced by `audit-collection-readiness.ts`.
- **Near the floor, adding durable questions is a regression.** Both content passes this
  session hit this. Queens would have fallen further under; oregon-state sat at exactly 10.0%
  and two good easy questions would have pushed it to 9.7%. Add expiring content alongside
  or do not add.
- **One question per officeholder counts PEOPLE; the repeated-shape rule counts TEMPLATES.**
  They are different tests and the Queens audit reported a conflict between the wrong pair.
  Both are now written in COLLECTION-PLAYBOOK.md.
- **Run the leakage check on questions you WRITE, not just ones you audit.** A new question
  collides with an old one's text just as easily as the reverse — caught `queny-212` before
  commit, and would have caught a third beaver answer in oregon-state.
- **A search summary is not a source.** It produced a false `ore-203` flag that had to be
  withdrawn in #137. Open the page.

**Do not:**

- Run `backend/src/scripts/repair-broken-links.ts --apply`. It overwrites curated source URLs
  with AI guesses, or nulls them, on a flaky single-HEAD verdict. See #131.
- Re-add the range-overlap branch to `nested-options`. Every range hit was a false positive;
  the reasoning is in the rule's own comments.
- Act on a raw link-sweep result. Three separate false-positive modes — 429 storms, 403 bot
  protection, and CRLF — are documented in `docs/superpowers/link-sweep-2026-09-27.md`.

**Outstanding on someone else's desk:** the CTC database credential. Doc handed to Chris
Andrews 2026-09-27, reply pending. `ev_api` is the approved interim.

### pittsburgh-pa — complete
92 -> 58 (34 archived) -> 65 (+7). Easy 26.1% -> 35.4%. Expiring 12.0% -> 15.4%.
bad_idx 0, bad_optcount 0, unlinked 0, duplicate answers 8 -> 0, spread 16/20/18/11.
  CITATION PASS (first collection to get one). 90 of 92 questions cited `en.wikipedia.org`,
  21 of them the single generic `/wiki/Pittsburgh` article. All 14 distinct URLs resolve
  (5 via redirect), so the link sweep was clean and the defects were all *support*, not
  reachability:
    - pitpa-068 asked population "according to the 2024 estimate" -> 307,668. The cited
      article gives 2020: 302,971 and a 2025 estimate of 307,632. Neither year nor figure
      was in the source. Rewritten to the 2025 figure, and the precise-number-among-round-
      numbers giveaway removed (all four options are now "About N").
    - pitpa-086 asked which neighborhood is divided into "Lower and Upper" sections ->
      Lawrenceville. The source lists Lower, **Central** and Upper. The two-part premise was
      also the only thing separating it from pitpa-090 (Squirrel Hill North/South).
      Rewritten to three sections; 090 archived as a duplicate answer.
    - pitpa-088 (transit agency -> Pittsburgh Regional Transit) was correct but cited to the
      *Duquesne Incline* article. Re-cited.
    - pitpa-067's answer "robotics **and artificial intelligence**" overstated a source that
      says only "National Robotics Engineering Center". Archived.
    - FALSE ALARM worth recording: pitpa-056 (city colors, cited to a *bridges* article)
      looked like an obvious mis-citation and was not — the article says "to match the
      city's official colors of black and gold." Check, do not assume, in both directions.
  REPEATED-SHAPE, worst yet: SEVEN identical "Who represents District N?" questions
    (012, 013, 017, 018, 092, 093, 094). Kept one (092), archived six, replaced with two
    questions about what the office *does* (pitpa-100 term length, pitpa-101 staggering).
  CONCENTRATION: 12 of 92 on the Point / Fort Duquesne site, 7 on the Cathedral of Learning,
    5 each on Warhol and Phipps, 4 on the Duquesne Incline.
  DUPLICATE ANSWERS / INVERSE PAIRS (8, now 0): 030+091 both "Paris of Appalachia";
    021+032 both "French and Indian War"; 065+066 both "Andrew Carnegie"; 085+090 both
    "Squirrel Hill"; 040/072 inverse (tallest building <-> company named on it);
    033/059 inverse (river confluence).
  LEAKAGE: 041 names U.S. Steel Tower (gives away 040), 038 names Mount Washington (036),
    046 names Nationality Rooms (045), 073 names the G20 (025), 066 names Phipps' donor (042),
    022 names Fort Duquesne (020).
  DEGENERATE: pitpa-078 "Andy Warhol was born in which city?" -> Pittsburgh, inside the
    Pittsburgh collection.
  ROTS BY CONSTRUCTION: pitpa-071 "first **and only** greenhouse" to hold Platinum LEED.
  EXPIRING FLOOR CONFLICT, and how it was resolved: the officeholder questions *are* the
    expiring ones, so archiving six district questions dropped expiring to 8.6% — under the
    10% hard floor. Backfilled five new expiring questions for offices the collection never
    covered rather than keeping the defective set: pitpa-102 (Allegheny County Executive,
    Sara Innamorato), 096 (US Rep PA-12, Summer Lee), 097 (police chief Jason Lando, sworn
    in Feb 2026), 098 (DA Stephen Zappala, term to 2028-01-03), 099 (next mayoral election,
    2029). Each is a distinct person, so the one-question-per-officeholder rule still holds.
  VERIFIED BEFORE TRUSTING, per the session-6 rule: Corey O'Connor really did take office in
    January 2026, and R. Daniel Lavelle really is still council president — pitpa-003 and
    pitpa-005 were correct. Only 005's stale "as of 2024" framing was removed.
  **NEW GOTCHA — the guarded insert can silently skip a question.** `ON CONFLICT
    (external_id) DO NOTHING` also collides with **archived** rows. `pitpa-095` was an
    archived question from a previous session, so the County Executive question vanished
    with no error and the insert returned 6 ids for 7 rows. Take the high-water mark from
    `max(external_id)` across **all statuses**, and count the returned ids against what you
    sent. Re-inserted as pitpa-102.

### plano-tx — complete
69 -> 40 (29 archived) -> 50 (+10). Easy 26.1% -> 38.0%. Expiring **1.4% -> 16.0%**.
bad_idx 0, bad_optcount 0, unlinked 0, duplicate answers -> 0, spread 13/11/12/14.
  CITATION PASS: **52 of 69 questions cited one URL** — the TSHA Handbook of Texas entry for
  Plano, about 1,100 words. That looked like the wmnla-038 failure at scale and it was not:
  every claim checked traced to the article, including the ones that sounded invented
  ("Balloon Capital of Texas", the Shawnee Trail, the Farrel-Wilson Farmstead Museum, W. F.
  Mister, "1,000 businesses"). Citations here are sound. The collection's problem is that one
  short article was **mined into duplicates**.
  METHOD CORRECTION, and the most useful thing this collection taught: the FIRST fetch
  summarised the article and produced two population figures that are not in it — 127,885
  for 1890->1990 and 824 for 1890. Both contradicted live questions. Acting on them would
  have rewritten two CORRECT questions into wrong ones. Asking for verbatim quotes returned
  "By 1890 the town had a population of 1,200" and "By 1990 it was a city of seventy-two
  square miles with a population of 128,713". **Demand quotes; a summary is not evidence.**
  DUPLICATE MINING (the dominant defect, 8 straight pairs): 070/142 both Frito-Lay;
    074/144 both the same early-industry list; 037/103 both "Balloon Capital of Texas";
    040/147 both the Farrel-Wilson museum; 013/113 near-identical text AND answer
    (Plano Conservancy); 056/121 both "about 400 new residents per decade"; 026/104 both the
    Houston and Texas Central; 052/107 inverse (year vs the number in the other's text).
  POPULATION-TABLE CONCENTRATION: **14 of 69 questions** were entries from one census table
    (1890, 1900, 1960, 1970, 1980 x4, 1990, 2000 x2, square miles, businesses, average per
    decade x2). Kept three that carry the growth story; archived the rest.
  INVERSE PAIRS: 047/053 ("outside of Texas" / "more than half" — the same sentence asked
    both ways), 036/083 (who founded the store / what he founded).
  REPEATED SHAPE: 050, 089, 100 were all "by 1890, how many X?" with the answer "Two".
  BRACKET ANSWER: pla-019's 1980 population answered "50,000-99,999", and pla-052's text
    gives the figure away anyway.
  EXPIRING WAS 1.4% — the worst in the ledger, one question in sixty-nine, and archiving
    could not fix it because the duplicates were all historical. Backfilled seven: city
    manager (Mark Israelson), Collin County judge (Chris Hill), police chief (Ed Drain),
    Plano ISD superintendent (Theresa Williams), county sheriff (Jim Skinner), Texas House
    District 70 (Mihaela Plesa), and the next mayoral election (2029).
  THE 50-QUESTION FLOOR DROVE THE BACKFILL SIZE. 29 archives left 40, below the floor, so the
    backfill was sized to clear it rather than to a round number: +10 lands exactly on 50
    with easy at 38% and expiring at 16%. Three non-expiring additions fill real gaps the
    collection never had — which county Plano is in, which school district serves it, and
    Toyota's 2017 North American headquarters.
  VERIFIED BEFORE TRUSTING: pla-005 named John B. Muns "as of 2025" and he is still mayor —
    re-elected May 2025, term to 2029. Only the stale framing was removed.
  NOT REPEATED FROM pittsburgh-pa: the external-id high-water mark was checked across all
    statuses first, and the insert returned 10 ids for 10 rows.

### washington-state — complete
103 -> 78 (25 archived, **no backfill needed**). Easy 26.2% -> 30.8%. Expiring 15.5% -> 17.9%.
bad_idx 0, bad_optcount 0, unlinked 0, duplicate answers -> 0, stale framing -> 0,
spread 20/22/19/17.
  **The first collection that needed nothing written.** It had never been audited (0 archived
  before this) yet cleared the expiring floor on its own, because whoever built the
  officeholder block sourced it to real news — Washington State Standard, Cascade PBS, a
  senate caucus post — rather than to a generic encyclopedia article. That one decision is
  the difference between this collection and plano-tx, which sat at 1.4% expiring.
  CITATION PASS: 57 of 103 cited the generic `Washington_(state)` article, the same shape
  that made plano-tx look alarming. **Zero citation defects found.** All fifteen officeholder
  claims were verified current for 2026 — governor (Ferguson), lieutenant governor (Heck),
  attorney general (Brown), secretary of state (Hobbs), treasurer, auditor, insurance
  commissioner, public lands, superintendent, House speaker (Jinkins), Senate majority leader
  (Pedersen), House majority leader (Fitzgibbon) and both U.S. senators. **Nothing needed
  correcting.** Eleven carried "as of 2025" framing, which was stripped; the facts behind
  them were all still true.
  MUTUAL LEAKAGE, textbook case: washs-031 asks which volcanic event "killed 57 people" and
    washs-041 asks how many died when Mount St. Helens erupted. Each question prints the
    other's answer. Same with washs-018/033 (Washington Territory, 1853, from Oregon
    Territory).
  ONE ANSWER GIVING AWAY TWO QUESTIONS (class 4): washs-098's answer, "Patty Murray and
    Maria Cantwell", contains both washs-102's and washs-103's answers verbatim.
  ALSO: washs-034's text ("the 42nd state in 1889") leaks both washs-019 and washs-020, and
    washs-053's answer prints "42nd state" again.
  CONCENTRATION: Grand Coulee Dam 8, state capitol 7, Mount Rainier 6, Hanford 6, and
    eleven state-symbol questions. The symbols were left alone — they are cheap, genuinely
    easy, varied in subject, and a state-tier collection is where they belong.
  NEW DEFECT CLASS RECORDED: compound answers (see #9 above). I drew the archive line at
    "compound AND something else" rather than compound alone; six otherwise sound questions
    were kept that an over-eager reading would have removed.
  NO BACKFILL. 78 questions clears the 50 floor, easy sits at 30.8% inside the 25-33% band,
    and expiring rose to 17.9% simply because the archived questions were historical. Adding
    content here would have been motion, not improvement.

### portland-or — complete
77 -> 42 (35 archived) -> 50 (+8). Easy 27.3% -> 44.0%. Expiring 18.2% -> 16.0%.
bad_idx 0, bad_optcount 0, unlinked 0, duplicate answers -> 0, stale framing -> 0,
spread 14/12/15/9.
  **CITATION PASS — the worst practice seen so far, and NOT fully fixed. 70 of 77 questions
  cited a homepage or a section index**: `portland.gov/` (39), `portland.gov/council` (16),
  `portland.gov/auditor` (12), `portland.gov/parks` (3). These are navigation pages. Unlike
  plano-tx, where one over-mined article genuinely contained every fact, a homepage cannot
  support "when was Portland first called the City of Roses" or "where is City Hall".
  **The archive removed most of them for other defects, but roughly twenty-five surviving
  questions still carry a `portland.gov/` citation. Re-citing those to specific pages is
  open work, not done here.** Only the eight `por-65x` questions and the new `por-66x` block
  cite a page that actually contains the claim.
  FOUR EXACT INVERSE PAIRS, all councilors: por-009/095 (Avalos <-> District 1),
    por-017/096 (Ryan <-> District 2), por-022/097 (Morillo <-> District 3),
    por-019/098 (Zimmerman <-> District 4). Eleven councilor-identity questions in total,
    across two mirrored shapes, and the "alongside X and Y" phrasing of the second shape
    leaked three more. Kept one (por-009), archived ten.
  WEBSITE FURNITURE (new class #9): room number, opening hours, and three questions about
    the Auditor's logo. por-018 and por-121 had the *same answer* word for word.
  **DIFFICULTY LABELS WERE TRACKING OBSCURITY, NOT DIFFICULTY.** Hard fell from 29 to 5,
    because 24 of the 35 archived questions were labelled hard — the councilor roll-call, the
    logo trivia, the room number. Nothing that was genuinely demanding was removed. If a
    collection looks hard-heavy, check whether it is difficult or merely obscure; the
    remaining 5 hard questions are the honest count for this collection.
  ALSO: por-311 leaked por-288's answer by printing "over 5,000 acres" in its own question
    text — repaired in place rather than archived, since both questions are sound apart from
    the leak. por-105 was an officeholder question with no expiry; it now has one.
  BACKFILL (+8, three expiring): Multnomah County chair (Vega Pederson), police chief (Bob
    Day), US representative for OR-3 (Dexter), plus PDX, the Timbers, Portland State, Pioneer
    Courthouse Square and the Oregon Zoo — all cited to pages that contain the claim.
  NOTE por-143 and por-288 were repaired earlier the same session by the nested-options pass;
    both survive here.

### washington-dc — complete
153 -> 91 (62 archived) -> 100 (+9). Easy 29.4% -> 32.0%. Expiring **9.8% -> 15.0%**.
bad_idx 0, bad_optcount 0, unlinked 0, duplicate answers -> 0, spread 27/23/29/21.
**The largest collection audited and the largest archive: 62 questions, 41% of it.**
  A CORRECTNESS DEFECT THE NESTED-OPTIONS RULE CANNOT SEE (new class #9): `wdc-414` asked
  which of four names is an at-large council member and scored Phil Mendelson wrong, while
  `wdc-407` in the same collection stated that the chair's seat is at-large. Kenyan McDuffie,
  a third option, had been at-large until he resigned in 2026 to run for mayor. Repaired by
  replacing the extra true options rather than archiving, so the expiring question survived.
  `wdc-413` and `wdc-414` were also near-identical text with different answers — the
  "pick one of the four at-large members" shape makes that near-inevitable.
  WORST CLASS-4 INSTANCE YET: `wdc-415`'s answer read "13 members: 1 Chair, 4 at-large
  members, and 8 ward members" — which is the answer to `wdc-001`, `wdc-002` AND `wdc-016`.
  One answer giving away three questions.
  DUPLICATE ANSWERS AT SCALE: three questions answered "the Wilson Building" (019, 308, 331),
  three "District of Columbia Court of Appeals" (004, 062, 069), three "Superior Court of the
  District of Columbia" (061, 242, 250), plus pairs on 1862, 2015, 1790 and "District of
  Columbia". `wdc-231`'s answer listed the Superior Court's case types, which is the answer
  to four other questions.
  OFFICEHOLDER LIMIT BREACHED THREE TIMES OVER: Bowser x4 (401-404), Mendelson x3 (405-407),
  Norton x3 (410-412). Kept one each.
  REPEATED SHAPE: eight "which neighborhood is in Ward N?" questions (259-266), kept one.
  Five separate "what percentage of voters..." questions, all archived as minutiae.
  VERIFICATION CAUGHT A STALE FACT BEFORE IT WAS WRITTEN IN: the obvious backfill was
  "who is D.C.'s police chief?" — Pamela Smith. She resigned in December 2025 and Jeffery
  Carroll took over on 1 January 2026. The question was written about the succession instead.
  Checking officeholders before writing them is as necessary as checking them before fixing.
  EXPIRING WAS BELOW THE HARD FLOOR at 9.8% before the audit and would have fallen to 6.6%
  after it, because every expiring question was in the `wdc-4xx` officeholder block that the
  one-per-person rule thinned. Backfilled nine, deliberately across nine DIFFERENT offices
  — CFO, police chief, schools chancellor, the mayoral primary, an at-large return, an
  at-large resignation, the election date, the minor-party nomination, and Ward 8 — rather
  than a roll-call, which is the defect that was just archived out of it.

### los-angeles-ca — complete (session 8, 2026-09-28)
73 -> 25 (48 archived, 66% of it) -> 55 (+30). Easy 30.1% -> 36.4%. Expiring **0.0% -> 18.2%**.
Readiness verdict READY (net 52 against the 50 floor); bad_idx 0, bad_optcount 0, unlinked 0,
no_source 0, duplicate answers 0, spread 15/13/12/15, numeric answers at an extreme 55.6%.
All 43 distinct citations return 200.
**The largest archive proportionally in the ledger, and the first collection where the
dominant defect was scope rather than quality.**

  ZERO EXPIRING QUESTIONS — worse than plano-tx's 1.4%, and the first collection at flat
    zero. The four county-supervisor questions were officeholder questions with no
    `expires_at` at all, and the collection had **no question about the mayor of Los
    Angeles**, in any form. Backfilled nine, plus an expiry on the surviving supervisor
    question, across ten different offices.
  OFF-TIER CONTENT (new class #12): 18 of 73 questions were about California, not Los
    Angeles — 4 on the ballot-proposition system, 7 on the state's student poll-worker
    programme, 7 on state facts (GDP share, national parks, campsites, foreign-born share,
    economy ranking, state parks, population). Ten were labelled `california-state` in their
    own topic column. `lac-042` duplicated `cas-036`, already live in collection 5.
    Archived, not moved — see the note in the priority list.
  CITATION PASS, and it found more real defects than any previous collection:
    - **`la-057` and `la-086` contradicted each other.** "Largest source of revenue" ->
      Utility users tax; "largest source of general fund revenue" -> Property tax. Same
      collection, same citation (`cao.lacity.gov/budget`, a JS page with no text in it).
      Crosstown, quoting the city budget: "Property taxes are the single largest source of
      city revenue, financing roughly one-fifth of city government." `la-057` archived,
      `la-086` kept and re-cited. Two questions cannot both answer the same question; when
      they do, one of them is live and wrong.
    - `la-061` asserted LACMA is "free to the public" and `la-088` the same of the La Brea
      Tar Pits Museum. **Both false** — LACMA is $30 ($25 for county residents), free only
      to members, under-18 county residents, county residents weekdays after 3pm, and second
      Tuesdays. Both were duplicates as well, so both archived.
    - `la-071` asked the pueblo's original name and offered "El Pueblo de la Reina de Los
      Ángeles". Its cited article says "El Pueblo de Nuestra Señora de los Angeles de
      Porciuncula"; the `Los Angeles` article says "El Pueblo de Nuestra Señora la Reina de
      los Ángeles". **No option was correct** and the name is genuinely contested. Archived
      as unanswerable rather than "corrected" to one of two disputed forms.
    - `la-082` claimed LA "adopted its **current** city charter" in 1925. The current charter
      was adopted 1999-06-08 and took effect 2000-07-01. Wrong, and unsupported by its
      citation, which says nothing about charters at all.
    - `la-096` answered "the first **publicly funded** Olympic Village **in U.S. history**".
      The cited article says only "LA introduced the first Olympic Village", and nothing
      about funding. Same overstatement shape as `pitpa-067`.
    - `lac-002` bracketed LA County's population as "10-14 million" against a distractor of
      "7-9 million". The county's own About page says "nearly 10 million residents" — the
      answer straddles the boundary and the bracket's top is 40% above reality. Replaced by
      `la-117` with honest round options.
    - `lac-043` named the "Office of Child Protection". Following its citation found
      `ocp.lacounty.gov` reading "This site has moved": the office was renamed the Office of
      Child, Youth, and Family Well-Being on 2026-03-17. Archived; `la-120` now asks about
      the rename itself.
  WEBSITE FURNITURE at scale: **18 of 73 questions cited the bare `bos.lacounty.gov`
    homepage.** Eight were org-chart entries — "which office does X" — rotating the same
    four office names through each other's option pools, so each gave the others away.
    Kept one (`lac-005`, the Inspector General, genuine oversight of the Sheriff and
    Probation), archived six. `lac-016` (an EV rebate amount) and `lac-063` ("what special
    service does LADWP offer on Saturdays") are the LADWP version of the same thing.
    The worst single citation count is now 6, and nothing cites a homepage.
  1850-INCORPORATION CLUSTER: five questions, four of which printed "1850" in their own
    text and so gave away the fifth (`la-055`, the easy one). Kept `la-055`, archived four.
  INVERSE / DUPLICATE PAIRS: `la-067`/`la-072` (ballot propositions, and `la-085`'s text
    prints `la-072`'s answer verbatim); `la-054`/`la-074` (two amphitheatres, each offered as
    the other's distractor); `lac-007`/`lac-079` (how far back county records go / which
    office keeps them — and `lac-079`'s text prints `lac-007`'s answer); `lac-121`/`lac-122`
    (15 districts / 15 members, the same fact twice).
  REPEATED SHAPE: four identical "Which Supervisor represents District N?" questions sharing
    one four-name option pool, which determines the fifth district by elimination. Kept one.
  DEGENERATE: `la-064` asked "Which agency operates the LADWP?" — naming the answer in the
    question, then answering with a description of its governance rather than an agency.
  VERIFIED BEFORE TRUSTING, per Chris's standing ask, and **all four supervisors were
    current**: Solis (D1), Horvath (D3), Hahn (D4), Barger (D5), all confirmed against the
    live Board page. Nothing needed correcting. Like `pitpa-056`, the check earns its cost in
    both directions — three of the last four collections had a stale officeholder, this one
    did not, and the difference was only visible by looking.
  TWO STALE FACTS CAUGHT BEFORE THEY WERE WRITTEN IN, which is where the real risk was:
    - The obvious LAUSD backfill is Alberto Carvalho. He **resigned effective 2026-06-21**
      after an FBI search and months on paid leave; Andrés Chait is acting superintendent.
      `la-106` asks about the succession instead.
    - The obvious city-attorney backfill is Hydee Feldstein Soto. She is still in office, but
      **finished third in the June 2026 primary (20.54%) and did not advance** — Marissa Roy
      and John McKinney meet in the November runoff. "Who is the city attorney?" would have
      been correct for another ten weeks and wrong thereafter. `la-103` asks what happened to
      her instead.
  BACKFILL (+30, nine expiring): mayor's runoff (Bass v. Raman), LAPD chief (McDonnell,
    59th), council president (Harris-Dawson), controller re-elected outright (Mejia), the
    city-attorney primary, the sheriff's runoff (Luna v. Villanueva), the district attorney
    (Hochman, 44th), the LAUSD succession, and how many council seats were on the 2026
    ballot — nine different offices, not a roll-call. Twenty-one durable questions fill gaps
    the collection simply never had: mayoral term and veto override, council term limits, the
    2000 charter and the neighbourhood councils it created, LAX/LAWA, Metro, Union Station,
    the Owens Valley aqueduct, the 2028 Olympics, Measure G (both the expansion and the new
    elected County Executive), the county's 88 cities and 42 contract cities, and the 2002
    San Fernando Valley secession vote.
  THE NET FLOOR FORCED A SECOND TOP-UP. The first backfill landed on 51 raw and the
    readiness script returned `NOT READY — BLOCKED` at net 48, because three of the new
    expiring questions fall inside 90 days. Four more durable questions took it to 55 /
    net 52. See the new readiness-gate section above; this is in no earlier ledger entry.
  NOT REPEATED FROM pittsburgh-pa: the external-id high-water mark was taken across **all**
    statuses first (`la-` 98, `lac-` 123, with 80 archived `lac-` rows sitting in the range),
    the insert guarded on collision in any status, and both inserts returned as many ids as
    rows sent (26/26 and 4/4).
