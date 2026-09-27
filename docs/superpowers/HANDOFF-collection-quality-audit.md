# HANDOFF — Collection Quality Audit (2026-09-27)

**Resume with:** `/gsd:resume-work` or just point a session at this file.

- Worktree: `C:/ctc-quality-audit`, branch `feat/collection-quality-audit`
- CTC PR #126 (open, green, NOT merged). ev-accounts PR #815 (open, 189/189).
- Spec: `docs/superpowers/specs/2026-09-26-collection-quality-audit-design.md`
- Plan: `docs/superpowers/plans/2026-09-26-collection-quality-audit.md`
- 11 of 43 collections done. 218 archived, 118 written. All archives reversible by `external_id`.

**Per-collection method** (repeat for each remaining slug):
1. `select external_id, difficulty, text, options->>correct_answer, options` for the collection
2. Read for: duplicate SETS, cross-question answer leakage, inverse pairs, answer-in-question,
   unanswerable-as-posed, state/city overlap, minutiae
3. One SQL call: archive + relabel + set `expires_at` on officeholders
4. One SQL call: insert easy backfill + guarded `collection_questions` link + verify
   (total / easy_pct / bad_idx / answer position spread)
5. Target: at least 25% easy, aiming 30%. Never demote just to stay under 33%.

**Open, not fixed:**
- `cam-076` vs `cam-092` contradict each other on the living wage (state vs federal minimum) — needs a source check
- New York questions are assigned topic_ids named "Oregon State Government" / "Mississippi State History"
- `pipelineCron` still never calls the quality rules engine — the nightly pipeline generates unguarded

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
