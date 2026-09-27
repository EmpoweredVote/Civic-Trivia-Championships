/**
 * Source Drift Quality Rule
 *
 * Some questions go wrong without anything about them changing. No date passes, no
 * officeholder turns over, the cited page still returns 200 — and the claim is no
 * longer true, because a rule underneath it was rewritten by somebody who does not
 * read this repo.
 *
 * Written for `lou-018`, which asked in what years Louisiana holds "its statewide
 * elections" and answered "odd years not coinciding with federal elections". Correct
 * when written. Act 1 of Louisiana's 2024 First Extraordinary Session then moved
 * U.S. House, U.S. Senate, state Supreme Court, PSC and BESE races to closed party
 * primaries from May 2026 — statewide contests, in even years. State executive
 * offices kept the odd-year open primary, so the fact survived and only the SCOPE of
 * the wording went stale.
 *
 * `expires_at` guards officeholders. `checkAnachronisticYear` guards impossible
 * years. `checkLearnMoreLink` guards reachability. None of them can see this, and
 * neither can a human reviewer who is not tracking that state's legislature.
 *
 * This rule is ADVISORY and deliberately so. It cannot know whether a claim is still
 * true — only a reader with the source in front of them can. What it does is narrow
 * the bank to the questions worth that reader's time, cheaply and with no network or
 * model call. A flag means "go and check this", never "this is wrong".
 */

/**
 * VENDORED from ev-accounts/backend/src/trivia/services/qualityRules/rules/source-drift.ts,
 * where the tests live (this repo has no test runner). That copy guards the nightly
 * pipeline; this one guards the collection-creation and audit scripts this repo still
 * owns. Keep the two in step -- same arrangement as anachronism and answerPlacement.
 */

import { RuleResult, QuestionInput, Violation } from '../types.js';

/**
 * Trigger A — a claim about election machinery whose scope is left open.
 *
 * The topic alone is NOT the signal. `lou-018` before and after its repair both
 * discuss elections; what changed is that the repair named the offices it covers.
 * A question scoped to "the governor and other state executive officials" fails
 * loudly when that scope changes. One scoped to "statewide elections" goes quietly
 * half-true, which is the failure this rule exists to surface.
 *
 * So the trigger requires BOTH an election-machinery term and an unqualified
 * universal — and fixing the scope is what clears it.
 */
const ELECTION_MECHANICS =
  /\b(primar(?:y|ies)|runoffs?|run-offs?|ballots?|elections?|elect(?:s|ed|ing)?|term\s+limits?|redistrict\w*|reapportion\w*|caucus(?:es)?|nominating)\b/i;

const UNQUALIFIED_SCOPE =
  /\b(statewide|state-wide|nationwide|all\s+(?:\w+\s+){0,2}(?:offices|elections|races|candidates|officials)|every\s+(?:office|election|race|candidate)|any\s+(?:office|election|race))\b/i;

/**
 * Trigger B — a superlative or ranking, which is a claim about everyone else.
 *
 * "The largest U.S. port" is not a fact about the port; it is a fact about every
 * other port, and it stops being true when one of them changes. The audit found
 * `tex-071` asserting the Texas constitution is the longest state constitution
 * (Alabama's is roughly three times longer), and `phxaz-080` asking how many
 * CONSECUTIVE years a university had been ranked first — a number that increments
 * by construction.
 *
 * A superlative on its own is not enough: "the oldest building in Baton Rouge" is a
 * local fact, while "the oldest in the United States" invites the whole field in.
 * The comparison field is what makes it drift-prone, so both halves are required.
 */
const SUPERLATIVE =
  /\b(largest|biggest|longest|oldest|highest|smallest|shortest|newest|most|only|first)\b/i;

/**
 * Boundaries sit inside each alternative, not around the group. "U.S." ends in a
 * period, so a trailing `\b` can never match it — the period and the following space
 * are both non-word characters, and there is no transition between them.
 */
const COMPARISON_FIELD =
  /(\bin\s+the\s+(?:nation|country|world|united\s+states)\b|\bu\.s\.|\bunited\s+states\b|\bamerican\b|\bthan\s+any\b|\bof\s+any\b|\bnationally\b|\bin\s+america\b)/i;

/** An explicit rank needs no comparison phrase — the ordinal already is one. */
const ORDINAL_RANK =
  /(\b\d+(?:st|nd|rd|th)\s+(?:largest|biggest|longest|oldest|highest|most)\b|\branks?\s+(?:#|no\.?\s*)?\d+|\branked\s+(?:#|no\.?\s*)?\d+)/i;

/**
 * Trigger C — a count of something a legislature can resize.
 *
 * St. Louis halved its Board of Aldermen from 28 wards to 14 by ballot measure, and
 * the audit found the collection had nothing on it. Seat counts, district counts and
 * bench sizes are all one statute or one census away from moving.
 *
 * "How much" is deliberately excluded. It asks about money and quantity, which for
 * these questions is almost always a settled historical figure — the Louisiana
 * Purchase price does not drift.
 */
const COUNT_FRAME = /\b(how\s+many|what\s+is\s+the\s+(?:total\s+)?number\s+of)\b/i;

const GOVERNED_NOUN =
  /\b(seats?|districts?|members?|wards?|parishes|counties|boroughs?|justices?|judges?|commissioners?|representatives?|senators?|precincts?|councill?ors?|aldermen|delegates?|chambers?)\b/i;

/**
 * ADVISORY RULE: flag questions whose claim depends on a rule someone else controls.
 *
 * Reads the question text only. The triggers are all about how the question FRAMES
 * its claim, and the frame lives in the stem — scanning options as well would add
 * false positives (a year in a distractor, a number in an option) without adding a
 * single real catch.
 *
 * @param question - Question to evaluate
 * @returns Rule result carrying at most one advisory violation
 */
export function checkSourceDrift(question: QuestionInput): RuleResult {
  const text = question.text;
  const triggers: string[] = [];

  if (ELECTION_MECHANICS.test(text) && UNQUALIFIED_SCOPE.test(text)) {
    triggers.push('election-mechanics-unscoped');
  }

  if (ORDINAL_RANK.test(text) || (SUPERLATIVE.test(text) && COMPARISON_FIELD.test(text))) {
    triggers.push('ranking-or-superlative');
  }

  if (COUNT_FRAME.test(text) && GOVERNED_NOUN.test(text)) {
    triggers.push('governed-count');
  }

  if (triggers.length === 0) {
    return { passed: true, violations: [] };
  }

  const violations: Violation[] = [
    {
      rule: 'source-drift-risk',
      severity: 'advisory',
      message:
        'Claim depends on a rule, ranking or count that an outside body can change ' +
        'without notice. Re-read it against its source before trusting it.',
      evidence: `triggers: ${triggers.join(', ')}`,
    },
  ];

  return { passed: false, violations };
}
