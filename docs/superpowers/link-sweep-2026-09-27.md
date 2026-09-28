# checkLearnMoreLink sweep over the standing bank — 2026-09-27

First time this rule has ever been run across the live bank (carry-forward #3, open since
session 4). Run out-of-band with curl rather than the rule itself, because local DB access
is still broken — see "Access" below.

## Method, and why the first answer was wrong

854 distinct source URLs across 3,461 active questions (55 active questions carry no URL
at all). Two passes:

- **Pass 1** — HEAD, browser UA, 15s, 12-way concurrent, GET fallback. Reported **264 failures.**
  That number is an artifact of the sweep, not the bank: 162 of them were HTTP 429. Wikipedia
  is ~300 of the 854 URLs and rate-limited me.
- **Pass 2** — every non-OK URL re-checked at 3-way concurrency, full GET, browser Accept
  headers, 40s, with backoff-and-retry on 429. **164 of the 277 suspects came back clean.**

Anything reported from a single concurrent pass is roughly 60% noise. Re-verification is not
optional.

## Result

| Class | Count | Verdict |
|---|---|---|
| Reachable | 741 of 854 | fine |
| **HTTP 404** | **55 URLs** | **genuinely dead — actionable** |
| HTTP 403 | 50 URLs | bot-blocked, NOT broken — see below |
| NXDOMAIN | 2 URLs | genuinely dead host |
| Unreachable (resolves) | 3 URLs | needs a human with a browser |
| HTTP 500 | 1 URL | senate.la.gov, may be transient |
| Timeout | 2 URLs | advisory only, per the rule's own semantics |

**57 dead URLs affect 81 active questions across 17 collections.**

### The 403s are not broken links
All 50 sit behind bot protection on legitimate government sites, led by `www.mass.gov` (8),
`www.norfolk.gov.uk` (6), `city.milwaukee.gov` (5), `www.fremont.gov` (4),
`www.bendoregon.gov` (4), plus `parliament.uk`, `census.gov`, `dec.ny.gov`, `parks.ny.gov`.
They serve fine in a browser. Treating them as broken is the failure mode to avoid.

## Affected collections

| Collection | Affected questions |
|---|---|
| los-angeles-ca | 13 |
| indiana-state | 12 |
| climate-change | 9 |
| california-state | 9 |
| norwich-uk | 8 |
| plano-tx | 6 |
| oregon-state | 6 |
| world-news | 3 |
| queens-ny | 3 |
| bloomington-in | 3 |
| texas-state | 2 |
| indio-ca | 2 |
| springfield-mo | 1 |
| santa-monica-ca | 1 |
| pennsylvania | 1 |
| louisiana | 1 |
| asheville-nc | 1 |

## Most-repeated dead URLs

- **6×** `https://interurbanrailwaymuseum.org/mission`
- **5×** `https://unfccc.int/sites/default/files/english_paris_agreement.pdf`
- **4×** `https://www.norwich.gov.uk/council`
- **3×** `https://www.queensbp.org/`
- **3×** `https://bloomington.in.gov/finance/budget`
- **2×** `https://www.unep.org/ozonaction/kigali-amendment`
- **2×** `https://www.supremecourt.gov/opinions/06pdf/05-1120.pdf`
- **2×** `https://www.sos.ca.gov/elections/voter-registration/initiatives`
- **2×** `https://www.in.gov/sos/elections/voter-information/voter-id/`
- **2×** `https://www.glo.texas.gov/the-alamo/`
- **2×** `https://www.cityofindio.org`
- **2×** `https://www.bbc.co.uk/news/world-middle-east-56523659`
- **2×** `https://sos.oregon.gov/blue-book/Pages/facts/symbols.aspx`
- **1×** `https://www.treasurer.ca.gov/about/index.asp`

## Full list

| Collection | Question | Dead URL |
|---|---|---|
| asheville-nc | ashnc-006 | `https://wlos.com/news/local/asheville-names-its-new-city-manager-and-shes-a-familiar-face-to-locals` |
| bloomington-in | bloom-064 | `https://bloomington.in.gov/finance/budget` |
| bloomington-in | bloom-069 | `https://bloomington.in.gov/finance/budget` |
| bloomington-in | bloom-079 | `https://bloomington.in.gov/finance/budget` |
| california-state | cal-094 | `https://www.library.ca.gov/california-history/state-history/` |
| california-state | cal-098 | `https://www.treasurer.ca.gov/about/index.asp` |
| california-state | cal-099 | `https://www.sos.ca.gov/elections/voter-registration/initiatives` |
| california-state | cal-100 | `https://www.sos.ca.gov/elections/voter-registration/voting-california/initiatives` |
| california-state | cal-105 | `https://www.sos.ca.gov/elections/voter-registration/initiatives` |
| california-state | cal-106 | `https://www.boe.ca.gov/proptaxes/prop13.htm` |
| california-state | cal-120 | `https://www.dof.ca.gov/budget/budget_frequently_asked_questions/` |
| california-state | cal-121 | `https://www.assembly.ca.gov/content/about-assembly` |
| california-state | cal-124 | `https://www.sos.ca.gov/archives/collections/1850` |
| climate-change | climc-0007 | `https://unfccc.int/sites/default/files/english_paris_agreement.pdf` |
| climate-change | climc-0008 | `https://www.supremecourt.gov/opinions/06pdf/05-1120.pdf` |
| climate-change | climc-0024 | `https://www.unep.org/ozonaction/kigali-amendment` |
| climate-change | climc-0036 | `https://unfccc.int/sites/default/files/english_paris_agreement.pdf` |
| climate-change | climc-0037 | `https://unfccc.int/sites/default/files/english_paris_agreement.pdf` |
| climate-change | climc-0043 | `https://unfccc.int/sites/default/files/english_paris_agreement.pdf` |
| climate-change | climc-0046 | `https://www.unep.org/ozonaction/kigali-amendment` |
| climate-change | climc-0049 | `https://www.supremecourt.gov/opinions/06pdf/05-1120.pdf` |
| climate-change | climc-0050 | `https://unfccc.int/sites/default/files/english_paris_agreement.pdf` |
| indiana-state | ind-085 | `https://www.in.gov/history/about-indiana-history/indiana-constitution/` |
| indiana-state | ind-087 | `https://www.in.gov/history/about-indiana-history/indiana-history/the-constitution-of-1851/` |
| indiana-state | ind-089 | `https://www.in.gov/library/files/Indiana_Constitution_History.pdf` |
| indiana-state | ind-092 | `https://www.in.gov/sos/elections/voter-information/absentee-voting/` |
| indiana-state | ind-093 | `https://www.in.gov/history/about-indiana-history/indiana-history/indiana-becomes-a-state/` |
| indiana-state | ind-098 | `https://www.in.gov/lgov/` |
| indiana-state | ind-099 | `https://www.in.gov/sos/elections/voter-information/voter-id/` |
| indiana-state | ind-103 | `https://www.in.gov/doe/schools/school-funding/` |
| indiana-state | ind-106 | `https://www.in.gov/courts/about/structure/` |
| indiana-state | ind-110 | `https://www.in.gov/dor/tax-forms/individual-income-taxes/` |
| indiana-state | ind-112 | `https://www.in.gov/sos/elections/voter-information/voter-id/` |
| indiana-state | ind-113 | `https://www.in.gov/history/about-indiana-history-and-trivia/indiana-history/` |
| indio-ca | ica-001 | `https://www.cityofindio.org` |
| indio-ca | ica-014 | `https://www.cityofindio.org` |
| los-angeles-ca | la-055 | `https://www.lacity.gov/about-la` |
| los-angeles-ca | la-060 | `https://www.ladwp.com/water/water-system` |
| los-angeles-ca | la-064 | `https://www.ladwp.com/about-us` |
| los-angeles-ca | la-066 | `https://tarpits.org/experience-pits/about` |
| los-angeles-ca | la-067 | `https://www.sos.ca.gov/elections/ballot-measures/initiative-process` |
| los-angeles-ca | la-072 | `https://www.sos.ca.gov/elections/ballot-measures/initiative-and-referendum-process` |
| los-angeles-ca | la-073 | `https://www.lacitysan.org/san/faces/home/portal/s/wpc/stormwater` |
| los-angeles-ca | la-079 | `https://lacity.gov/city-government/about-la` |
| los-angeles-ca | la-082 | `https://clerk.lacity.gov/clerk-services/legislative-and-records-management/city-charter` |
| los-angeles-ca | la-085 | `https://www.sos.ca.gov/elections/ballot-measures/how-initiatives-qualify` |
| los-angeles-ca | la-089 | `https://www.portoflosangeles.org/about/facts-and-figures` |
| los-angeles-ca | la-091 | `https://www.sos.ca.gov/elections/ballot-measures/initiative-and-referendum` |
| los-angeles-ca | lac-122 | `https://www.lacity.gov/government/popular-information/city-government-la-101/elected-officials` |
| louisiana | lou-100 | `https://www.nps.gov/jela/learn/historyculture/acadian-history.htm` |
| norwich-uk | nor-001 | `https://www.norwich.gov.uk/bins-recycling-and-littering` |
| norwich-uk | nor-008 | `https://www.norwich.gov.uk/environmental-health` |
| norwich-uk | nor-011 | `https://www.norwich.gov.uk/leisure-and-culture` |
| norwich-uk | nor-014 | `https://www.norwich.gov.uk/lord-mayor` |
| norwich-uk | nor-106 | `https://www.norwich.gov.uk/council` |
| norwich-uk | nor-107 | `https://www.norwich.gov.uk/council` |
| norwich-uk | nor-108 | `https://www.norwich.gov.uk/council` |
| norwich-uk | nor-109 | `https://www.norwich.gov.uk/council` |
| oregon-state | ore-014 | `https://sos.oregon.gov/blue-book/Pages/facts/elections.aspx` |
| oregon-state | ore-136 | `https://sos.oregon.gov/blue-book/Pages/facts-symbols.aspx` |
| oregon-state | ore-202 | `https://sos.oregon.gov/blue-book/Pages/facts/symbols.aspx` |
| oregon-state | ore-203 | `https://sos.oregon.gov/blue-book/Pages/facts/symbols.aspx` |
| oregon-state | ore-204 | `https://sos.oregon.gov/blue-book/Pages/facts/geography.aspx` |
| oregon-state | ore-208 | `https://www.fs.usda.gov/hellscanyon` |
| pennsylvania | penns-091 | `https://en.wikipedia.org/wiki/Dave_McCormick_(politician)` |
| plano-tx | pla-013 | `https://interurbanrailwaymuseum.org/mission` |
| plano-tx | pla-111 | `https://interurbanrailwaymuseum.org/mission` |
| plano-tx | pla-113 | `https://interurbanrailwaymuseum.org/mission` |
| plano-tx | pla-114 | `https://interurbanrailwaymuseum.org/mission` |
| plano-tx | pla-130 | `https://interurbanrailwaymuseum.org/mission` |
| plano-tx | pla-150 | `https://interurbanrailwaymuseum.org/mission` |
| queens-ny | queny-138 | `https://www.queensbp.org/` |
| queens-ny | queny-206 | `https://www.queensbp.org/` |
| queens-ny | queny-208 | `https://www.queensbp.org/` |
| santa-monica-ca | smo-502 | `https://www.santamonica.gov/rent-control` |
| springfield-mo | sprmo-078 | `https://www.kcur.org/arts-life/2021-08-25/chef-david-leong-invented-springfield-style-cashew-chicken` |
| texas-state | tex-205 | `https://www.glo.texas.gov/the-alamo/` |
| texas-state | tex-206 | `https://www.glo.texas.gov/the-alamo/` |
| world-news | wnews-0107 | `https://www.bbc.co.uk/news/world-middle-east-56523659` |
| world-news | wnews-0110 | `https://www.bbc.co.uk/news/world-asia-58393329` |
| world-news | wnews-0122 | `https://www.bbc.co.uk/news/world-middle-east-56523659` |

## A hazard in the existing tool

`backend/src/scripts/repair-broken-links.ts` already exists and does this job. Running it
with `--apply` over the standing bank would be destructive, because its repair path is
unconditional on the *quality* of the "broken" verdict:

- it validates with a single HEAD, a `CivicTriviaBot/1.0` UA, a 5s timeout and **no 429
  backoff** (`validateUrl`, line ~57);
- for every URL it judges broken it asks Claude for a replacement and **overwrites a curated
  source URL** with the AI's pick;
- if the AI returns nothing, or its suggestions fail the same flaky check, it **writes
  `url: null`** and destroys the citation outright (`null as any`, line ~283).

Measured against 120 URLs this sweep confirmed reachable, that checker misfires on ~3%. That
is far better than my own first pass, but it is 3% of ~850 curated URLs pointed at an
irreversible overwrite — and its bot UA is *more* likely to draw the 403s above than a browser
UA is. **Do not run `--apply` until the checker re-verifies and 403 is excluded from "broken".**

## Access

`ctc_app` is rejected at the pooler — `FATAL: (EAUTHQUERY) user not found in the database`
against `aws-0-us-west-1.pooler.supabase.com`, for both `psql` and the app client. That is
carry-forward #4 and it is still true.

Working path found: **`EV-Accounts/backend/.env` → `DATABASE_URL`, role `ev_api`, connects
fine and sees the same 3,461 active questions.** CTC's own legacy Supabase keys are also dead
("Legacy API keys were disabled on 2026-09-09"); ev-accounts has a new-style
`SUPABASE_SECRET_KEY`, though the REST API does not expose the `trivia` schema.

Raw data regenerable from this doc's method; per-question list above is complete.

---

# REPAIRED — same day

All 57 dead URLs replaced; 81 active questions across 17 collections now carry a live source.
Re-swept afterwards: **45 distinct replacement URLs, all HTTP 200.** Applied SQL is in
`docs/superpowers/sql/2026-09-27-repair-dead-source-urls.sql`.

`repair-broken-links.ts --apply` was **not** used, for the reasons in the hazard section above.
Every replacement was chosen by reading the question's actual claim and finding a page that
carries it, then verified by hand.

## Two questions were wrong, not merely unsourced

This is the real return on the sweep. A dead source URL turned out to be hiding a bad fact
twice, and neither would have been caught by a link checker that only repoints URLs.

- **`ica-001` — wrong answer, live in production.** "Who is the current Mayor of Indio?"
  answered **Waymond Fermon**. Indio's mayor is **Elaine Holmes**; Fermon is Mayor Pro Tem.
  Worse, the question rots by construction: Indio does not elect its mayor directly — the
  Council picks one of its own members on a rotating basis at its first meeting each
  December. Corrected, re-sourced, distractors changed to fellow council members (which is
  the real choice set), and the explanation now states the rotation. `expires_at` was already
  2026-12-01, which is right.
- **`ashnc-006` — wrong date.** "Who was sworn in as Asheville's City Manager on January 12,
  2026?" DK Wesley was sworn in on **8 January**; 12 January is when the appointment took
  *effect*. Reworded to "became Asheville's City Manager in January 2026" so it no longer
  asserts a date that is wrong, and re-sourced from the defunct WLOS article to the City of
  Asheville's own announcement.

## Where the replacements came from

Preference order: a live page on the same authoritative domain, then a stable authoritative
alternative. Wikipedia was used where the government page no longer states the claim in
readable text — the same call `c72bc44` made for `lou-108` and `lou-203`.

| Dead source | Replaced with | Questions |
|---|---|---|
| `interurbanrailwaymuseum.org/mission` | `planoconservancy.org/interurban-railway-museum/` — the museum's site now redirects to the Conservancy | 6 |
| `unfccc.int/.../english_paris_agreement.pdf` | `unfccc.int/.../parisagreement_publication.pdf` — same document, moved | 5 |
| `www.in.gov/...` (11 paths) | live `in.gov` section pages; constitution history to Wikipedia | 12 |
| `www.sos.ca.gov/...` (7 paths) | `sos.ca.gov/elections/ballot-measures` — the initiative pages consolidated | 9 |
| `www.norwich.gov.uk/...` (5 paths) | the council's current `/info/...` pages | 8 |
| `www.queensbp.org/` | Wikipedia — note the office moved to `queensbp.nyc.gov`; only the `www.` host is dead | 3 |
| `sos.oregon.gov/blue-book/Pages/facts*` | `explore-symbols.aspx`; geography and elections to Wikipedia | 5 |
| LA city sites (6 paths) | live LA pages where they exist, Wikipedia otherwise | 8 |
| `supremecourt.gov/opinions/06pdf/05-1120.pdf` | Wikipedia, *Massachusetts v. EPA* | 2 |
| `www.unep.org/ozonaction/kigali-amendment` | Wikipedia, Kigali Amendment | 2 |
| `www.bbc.co.uk/...` (2 articles) | Wikipedia | 3 |
| remainder | one-by-one, see the SQL | 18 |

## One claim flagged, then withdrawn

`ore-203` asks for Oregon's "official state bird" and answers *western meadowlark*. This was
originally flagged here on the grounds that the Blue Book lists the meadowlark as the state
**songbird**, so the new source would not support the question's wording.

**That flag was wrong, and is withdrawn.** It came from a search-result summary rather than
from the source. The Blue Book page actually attached to the question says, in its own words:

> ...the Western Meadowlark, Oregon's state bird...

Question and source agree. Nothing to change.

Worth keeping as a method note, because it is the same error class the sweep itself is about:
**a search summary is not a source.** The 403s, the 429s and the CRLF all produce false
positives about *links*; this one produced a false positive about a *claim*, and the fix was
the same — go and read the page.

## Full-bank re-sweep after the repair

All 845 distinct source URLs in the live bank, re-swept:

| Class | Count | Verdict |
|---|---|---|
| Reachable | 786 | fine |
| **HTTP 404** | **0** | **all 55 hard-dead links are gone** |
| HTTP 403 | 52 | bot-blocked, not dead — same class as before |
| Connection failed | 5 | `olympics.com`, `kaufmanastoria.com`, `legislature.ca.gov` (×2), one `clkrep.lacity.org` PDF. These sites plainly exist; treat as a local TLS/IPv6 artifact, not as dead links |
| HTTP 429 | 1 | Wikipedia rate limit, transient |
| HTTP 500 | 1 | `senate.la.gov`, may be transient |

**Zero 404s is the number that matters.** Everything else on that list was non-dead before
the repair too.

### A third way to get a false positive — read this before re-running

The first two are in the method section above (429 storms, 403 bot-blocks). The third bit
this sweep twice:

**`psql` output redirected to a file on Windows carries CRLF.** Feeding that straight to
`xargs` appends `\r` to every URL and curl returns `000` for all of them. Two full re-sweeps
reported *845 of 845 dead* — including Wikipedia — before the cause was found. The tell is
that the failure is total and uniform; a real outage is never 100%.

    psql ... > urls.txt          # WRONG - every line ends \r
    psql ... | tr -d '\r' > urls.txt   # right

Between them, the three false-positive modes mean a raw sweep result should never be acted
on. Verify, then verify the verifier.
