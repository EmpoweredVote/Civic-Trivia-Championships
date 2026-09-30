import type { LocaleConfig } from './bloomington-in.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CRITICAL ACCURACY NOTES — Akron, OH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every fact below was verified against a source that was fetched and read.
 * This block is a LIST, and it protects exactly what is on it — `milwaukee-wi`
 * had one and shipped zero wrong facts; `bloomington-in` had none and shipped
 * five. Put countable, confusable facts here. Do not generate a question about
 * a governance topic this block does not cover without checking a source first.
 *
 * ── STRUCTURE (confirmed by THREE independent sources) ─────────────────────
 * Akron City Council has exactly 13 members: 10 ward representatives (Wards
 * 1-10) and 3 at-large members. Not 9, not 12, not 15. All serve FOUR-year
 * terms. Confirmed by akronohio.gov/government, akroncitycouncil.org/members,
 * and the Signal Akron government glossary.
 *
 * Akron is a MAYOR-COUNCIL city ("strong mayor"), NOT a council-manager city.
 * There is no city manager. The charter was first adopted 5 Nov 1918 and took
 * effect 20 Jan 1920.
 *
 * The city describes itself as having THREE branches: Executive (Mayor),
 * Legislative (Council), Judicial (Akron Municipal Court).
 *
 * ── ELECTED vs APPOINTED — the single easiest thing to get wrong ───────────
 * The shared `essentials.offices` table has `is_appointed_position` NULL on all
 * 14 Akron rows. NULL IS NOT FALSE. Elected-vs-appointed below comes from the
 * charter and the city's own pages, never from that column.
 *
 *   ELECTED citywide/by ward : Mayor; all 13 Council members.
 *   APPOINTED by the Mayor   : every department director, including the
 *                              Director of Law. Department heads are cabinet
 *                              appointments, not elected offices.
 *   CHOSEN BY COUNCIL        : the President of Council — an internal
 *                              leadership post selected ANNUALLY by the
 *                              members, NOT a citywide election and NOT a
 *                              four-year office.
 *
 * The Mayor may VETO legislation passed by Council.
 *
 * ── CURRENT OFFICEHOLDERS (as of 2026-09-29) ───────────────────────────────
 * Mayor: Shammas Malik, took office 1 January 2024.
 * President of Council: Margo Sommerville (Ward 3), re-elected to the
 *   presidency 11-1 on 5 January 2026.
 * Wards 1-10: Fran Wilson, Phil Lombardo, Margo Sommerville, Jan Davis,
 *   Johnnie Hannah, Brad McKitrick, Donnie Kammer, Bruce Bolden, Tina Boyes,
 *   Sharon Connor.
 * At-large: Linda F. R. Omobien, Mark Greer, Eric D. Garrett, Sr.
 *
 * ── TRAPS — do NOT write these questions wrong ─────────────────────────────
 * 1. Mark Greer was APPOINTED by Council in April 2026 to fill a vacant
 *    at-large seat. He was not elected to it. Avoid "who was elected...".
 * 2. Fran Wilson (Ward 1) and Bruce Bolden (Ward 8) won in 2025 to finish
 *    UNEXPIRED terms. Do not imply they began fresh four-year terms in 2026.
 * 3. Ohio municipal court judges serve SIX-year terms, not four.
 * 4. Akron Public Schools is a SEPARATE government: a 7-member Board of
 *    Education elected AT-LARGE to four-year terms, with an APPOINTED
 *    treasurer. The city does not run the schools and the Mayor does not
 *    appoint the board.
 * 5. METRO RTA is a SUMMIT COUNTY regional transit authority, not an Akron
 *    city department.
 * 6. Summit County has a county EXECUTIVE (Ilene Shapiro, since 1 Aug 2016) —
 *    it is a charter county and does NOT use the three-commissioner form that
 *    most Ohio counties use.
 * 7. Water and public works ARE city functions, under the Department of
 *    Service. Do not attribute them to the county.
 *
 * ── EXPIRATION GUIDANCE ────────────────────────────────────────────────────
 * Ohio holds municipal elections in ODD-numbered years: May primary, November
 * general. Current terms began 1 Jan 2024 and run to 31 Dec 2027; the next
 * general election is November 2027.
 *
 * Set `expiresAt` = 2027-12-31T23:59:59Z for any question naming the Mayor or
 * a sitting Council member.
 *
 * WARNING — SINGLE CLIFF: Akron elects its entire council and mayor together,
 * so every officeholder question expires on the SAME DAY. To avoid the whole
 * expiring tier dying at once, include the annually-chosen Council presidency
 * (expires 2027-01-05T23:59:59Z, when Council next picks leadership) so the
 * tier has at least one earlier date. Prefer time-bound facts with varied
 * dates over more officeholder questions.
 *
 * ── WHAT TO AVOID ──────────────────────────────────────────────────────────
 * - No street addresses or phone numbers in answer options.
 * - No "According to ..." openers in explanations. Attribution lives in
 *   `source.url`.
 * - No roll-call questions ("which of these is NOT a council member?").
 *   Build the officeholder tier on DISTINCT OFFICES, not more slot-holders.
 * - Max ONE question per officeholder, counted by person. "Who is the mayor?"
 *   and "what office does Shammas Malik hold?" are the same person.
 * - Never put the answer inside the question ("What is the Rubber City's
 *   nickname?").
 * - Do not cite Wikipedia articles "Akron City Council" or "Akron Municipal
 *   Court" — VERIFIED 2026-09-29: neither article exists.
 * - library.municode.com returns a JavaScript shell with no code text. Do not
 *   cite it.
 */
export const akronOhConfig: LocaleConfig = {
  locale: 'akron-oh',
  name: 'Akron, OH',
  collectionSlug: 'akron-oh',
  targetQuestions: 100,
  batchSize: 25,
  overshootFactor: 1.3,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description:
        'Akron city government: the mayor-council charter form, the 13-member Council (10 wards + 3 at-large), the mayor as chief executive with veto power, appointed department directors, and how Akron relates to Summit County. Structural questions about who holds which power, not rosters of names.',
    },
    {
      slug: 'civic-history',
      name: 'Civic History',
      description:
        'Akron founding and civic milestones: the 1918 charter, the Ohio & Erie Canal origins, the rubber industry that named the city, annexations, and changes to the form of government. Historical facts that do not expire.',
    },
    {
      slug: 'local-services',
      name: 'Local Services',
      description:
        'What Akron actually runs and what it does not: city water and public works under the Department of Service, police and fire, Recreation and Parks; versus separately governed Akron Public Schools, METRO RTA transit, and Summit County services. Questions that test which level of government is responsible.',
    },
  ],

  // Target question counts per topic (sums to 100)
  topicDistribution: {
    'city-government': 40,
    'civic-history': 30,
    'local-services': 30,
  },

  // Every URL below was FETCHED and READ on 2026-09-29, and the fact it
  // supports is named. Rejected: library.municode.com (JavaScript shell, no
  // code text at any path).
  sourceUrls: [
    // Three branches, department list, "10 Ward Representatives, and 3 At-Large members"
    'https://www.akronohio.gov/government/index.php',
    // All 13 sitting members by ward and at-large; names the Council President
    'https://www.akroncitycouncil.org/members',
    // Local-press glossary: council composition, mayor's cabinet appointments
    'https://signalakron.org/glossary-to-navigate-local-government-in-akron/',
    // City portal — confirms sitting mayor, department structure
    'https://www.akronohio.gov/',
    // Existence verified via the Wikipedia API on 2026-09-29
    'https://en.wikipedia.org/wiki/Akron,_Ohio',
    'https://en.wikipedia.org/wiki/Summit_County,_Ohio',
    'https://en.wikipedia.org/wiki/Akron_Public_Schools',
    'https://en.wikipedia.org/wiki/METRO_Regional_Transit_Authority',
    'https://en.wikipedia.org/wiki/Shammas_Malik',
  ],

  // Deliberately SHORT. The officeholder tier is built on DISTINCT OFFICES, not
  // on listing all 13 members — that is the roll-call shape ruled out on
  // 2026-09-29. Sommerville carries an earlier termEnd on purpose: the Council
  // presidency is re-chosen every January, so it is the one officeholder fact
  // that does not expire on Akron's single 2027 cliff.
  officeholders: [
    { name: 'Shammas Malik', role: 'Mayor', termEnd: '2027-12-31T23:59:59Z' },
    {
      name: 'Margo Sommerville',
      role: 'President of Council',
      termEnd: '2027-01-05T23:59:59Z',
      district: 'Ward 3',
    },
  ],
};
