import type { LocaleConfig } from './bloomington-in.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CRITICAL ACCURACY NOTES — Ohio (STATE collection)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Read the two warnings at the top before writing anything.
 *
 * ── WARNING 1: DO NOT WRITE STATEWIDE-EXECUTIVE OFFICEHOLDER QUESTIONS ─────
 * As of 2026-09-29, ALL FIVE Ohio statewide executive seats are OPEN on
 * 2026-11-03 — about five weeks away — because every incumbent is term-limited:
 *
 *   Governor            DeWine term-limited    -> Ramaswamy v Acton
 *   Secretary of State  LaRose term-limited    -> Sprague v Russo
 *   Treasurer           Sprague leaving        -> Edwards v Walsh
 *   Attorney General    open                   -> Faber v Kulewicz
 *   Auditor             open                   -> LaRose v Blackwell
 *
 * Winners take office in January 2027. The shared `essentials.offices` table
 * still lists DeWine, Tressel, LaRose, Sprague and Wilson, and every one of
 * them looks correct today. A question naming any of them is wrong in January.
 *
 * Build the officeholder tier instead on:
 *   - U.S. Senators (SIX-year staggered terms)
 *   - Ohio Senate seats (four-year staggered; only half are up each cycle)
 *   - Structural facts that never expire (chamber sizes, term lengths, the
 *     order of succession, what each office does)
 *
 * ── WARNING 2: STRICT STATE SCALE ──────────────────────────────────────────
 * Test every question: "could a future CITY collection own this?" If yes, cut
 * it. Akron is being built in the same batch, so this is concrete, not
 * hypothetical — anything about Akron's council, mayor, wards or departments
 * belongs to `akron-oh` and is a DEFECT here.
 *
 * Cities may appear ONLY as seats of state institutions: "Ohio's capital is
 * Columbus" is fine; anything about Columbus's own city government is not.
 * Natural features only when tied to statewide policy or law.
 *
 * ── COUNTABLE FACTS (verified 2026-09-29) ──────────────────────────────────
 * Ohio House of Representatives: 99 members, two-year terms.
 * Ohio Senate: 33 members, four-year staggered terms. NOT 35 — the shared
 *   offices table lists 35 under the title "Senator" because it conflates the
 *   33 state senators with Ohio's 2 U.S. Senators. Do not repeat that number.
 * U.S. House delegation: 15 districts.
 * Statewide elected executives: Governor, Lieutenant Governor, Attorney
 *   General, Auditor of State, Secretary of State, Treasurer of State.
 *   The AUDITOR IS ABSENT from the shared offices table — absence there is not
 *   evidence an office does not exist.
 * Ohio municipal court judges serve SIX-year terms.
 * Ohio holds municipal elections in ODD-numbered years; statewide executives
 *   are elected in even mid-term years (2026, 2030...).
 *
 * ── DATA TRAP ──────────────────────────────────────────────────────────────
 * In `essentials.offices`, Summit COUNTY offices (County Executive, Sheriff,
 * Clerk of Courts, Fiscal Officer, County Engineer, Prosecuting Attorney,
 * Council Districts 1-8) all carry `representing_city = NULL`. A naive
 * "representing_city IS NULL" filter for Ohio therefore returns COUNTY
 * officials as though they were state ones. Summit County also uses a county
 * EXECUTIVE rather than the three-commissioner form most Ohio counties use, so
 * it is doubly unrepresentative. County government is not state government and
 * is not this collection's scope.
 *
 * ── WHAT TO AVOID ──────────────────────────────────────────────────────────
 * - No "According to ..." openers. Attribution lives in `source.url`.
 * - No roll-call questions. Build on DISTINCT OFFICES, not more slot-holders.
 * - Max ONE question per officeholder, counted by person.
 * - No street addresses or phone numbers in answer options.
 * - Never put the answer inside the question.
 * - Do not write about any Akron institution. That is `akron-oh`.
 */
export const ohioConfig: LocaleConfig = {
  locale: 'ohio',
  name: 'Ohio',
  collectionSlug: 'ohio',
  targetQuestions: 100,
  batchSize: 25,
  overshootFactor: 1.3,

  topicCategories: [
    {
      slug: 'state-government',
      name: 'State Government',
      description:
        'Ohio state government: the General Assembly (99-member House on two-year terms, 33-member Senate on four-year staggered terms), the six statewide elected executives and what each actually does, the Ohio Supreme Court, and how the state constitution structures power. Focus on offices, powers and terms — NOT on who currently holds them, because every statewide executive seat changes hands in January 2027.',
    },
    {
      slug: 'civic-history',
      name: 'Civic History',
      description:
        "Ohio's statehood and constitutional history: admission to the Union, the 1851 constitution, the capital's moves before settling at Columbus, statewide ballot initiatives and referendums, and changes to the structure of state government. Facts that do not expire.",
    },
    {
      slug: 'state-services',
      name: 'Elections and State Services',
      description:
        'How Ohio runs elections and statewide services: the Secretary of State as chief elections officer, county boards of elections, odd-year municipal versus even-year state election cycles, initiative and referendum mechanics, and which responsibilities sit with the state rather than with cities or counties.',
    },
  ],

  // Target question counts per topic (sums to 100)
  topicDistribution: {
    'state-government': 40,
    'civic-history': 30,
    'state-services': 30,
  },

  // ── SOURCE LIST — validated THROUGH THE PIPELINE'S OWN EXTRACTOR ──────────
  // Measured 2026-09-29 with the exact logic in rag/fetch-sources.ts.
  //
  // REJECTED, with measured yields — do not re-add:
  //   codes.ohio.gov/ohio-constitution/article-* .. 73 chars (JS-rendered)
  //   www.ohiosos.gov/** ......................... HTTP 403
  //   ohioattorneygeneral.gov/About-AG ........... 0 chars
  //   legislature.ohio.gov ....................... connection failure
  //   ohiosenate.gov/members/senate-directory .... HTTP 404
  //
  // DELIBERATELY EXCLUDED FOR SIZE AND TONE: Ohio Revised Code chapters 9
  // (417K), 1901 (264K), 3501 (166K), 3505 (159K), 733 (90K), 107 (87K),
  // 731 (82K) and 705 (73K). They extract cleanly, but source documents are
  // sent to the model in every batch, so 1.3M characters of statute would both
  // dominate the token budget and drag the collection toward dry statutory
  // trivia. Ohio civics is better served by encyclopedic sources. ORC 3501 is
  // the one worth revisiting if the elections topic comes out thin.
  sourceUrls: [
    // Wikipedia is fetched via the Wikipedia API, not the HTML extractor.
    // All ten titles verified to exist on 2026-09-29.
    'https://en.wikipedia.org/wiki/Ohio',
    'https://en.wikipedia.org/wiki/Government_of_Ohio',
    'https://en.wikipedia.org/wiki/Ohio_General_Assembly',
    'https://en.wikipedia.org/wiki/Ohio_House_of_Representatives',
    'https://en.wikipedia.org/wiki/Ohio_Senate',
    'https://en.wikipedia.org/wiki/Supreme_Court_of_Ohio',
    'https://en.wikipedia.org/wiki/Constitution_of_Ohio',
    'https://en.wikipedia.org/wiki/Governor_of_Ohio',
    'https://en.wikipedia.org/wiki/Ohio_Attorney_General',
    'https://en.wikipedia.org/wiki/Ohio_Secretary_of_State',

    // State institution sites, char counts measured through the extractor
    'https://ohiohouse.gov/',                    // 3,284
    'https://ohiohouse.gov/members/directory',   // 3,079
    'https://ohiosenate.gov/',                   // 1,410
    'https://ohioauditor.gov/',                  // 5,202
    'https://www.ohiotreasurer.gov/',            // 2,232
    'https://www.supremecourt.ohio.gov/',        // 7,863
  ],

  // Deliberately EMPTY. See Warning 1: every statewide executive seat is open
  // on 2026-11-03, so there is no sitting officeholder worth anchoring a
  // question to. The expiring tier must come from staggered seats and
  // structural facts instead.
  officeholders: [],
};
