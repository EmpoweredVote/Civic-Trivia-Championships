/**
 * Answer placement — the write-time guard against answer-position collapse.
 *
 * ## Two copies — keep them in step
 *
 * This file exists twice and neither copy can be deleted:
 *
 *  - `ev-accounts/backend/src/trivia/services/questionQuality/answerPlacement.ts` guards
 *    the four production insert paths — the replacement cron, the two election
 *    generators, and the international generator. That copy is what runs in production.
 *  - `Civic-Trivia-Championships/backend/src/services/questionQuality/answerPlacement.ts`
 *    serves that repo's content scripts, which are explicitly NOT frozen even though the
 *    `backend/` around them is, and its `audit-collection-readiness.ts` imports
 *    `magnitudeRank` as the detection backstop.
 *
 * The two are kept identical on purpose, including this comment, so `diff` between them
 * (modulo line endings) is the drift check. A change to one is a bug until it lands in
 * the other. The guard was absent from the production copy for its first day of life for
 * exactly this reason — see `backend/FROZEN.md`.
 *
 * ## What went wrong
 *
 * Options are stored in `questions.options` and served in stored order. `stripAnswers()`
 * removes `correctAnswer` from the payload, but nothing shuffles the options themselves —
 * only the *questions* are shuffled (questionService.ts, gameModes.ts). So the stored
 * index is the position the player sees.
 *
 * Every generator prompt shows the model an output example containing `"correctAnswer": 0`,
 * and the model copies it. By 2026-09-08 that had produced five collections where the
 * answer was at position A in 100% of active questions — 457 questions where "always pick
 * A" won every game — and 30 of 42 collections above the 40% warning line, Federal (the
 * collection every player sees) among them at 73.5% on "always pick B".
 *
 * ## Why this is a transform and not a rule
 *
 * `qualityRules` are per-question validators, and no single question is wrong for having
 * its answer first. The defect only exists as a distribution, so a validator cannot see
 * it — and a *prompt* instruction is advisory: the model may or may not comply, and
 * nothing detects it when it silently stops complying. This module is deterministic and
 * runs on the write path, so compliance is not optional.
 *
 * `audit-collection-readiness.ts` remains the backstop that proves it is working.
 *
 * ## Two kinds of options
 *
 * A **magnitude series** (four comparable numbers sharing a unit) is sorted ascending
 * rather than permuted -- unless it is a *bounded* series, whose rank is fixed by the
 * real world and which is permuted instead; see isBoundedSeries(). That is deliberate: for a sorted series the answer's display
 * position IS its value rank, so the position histogram and the value-rank histogram
 * measure the same thing and neither can hide behind the other. Permuting a numeric
 * series instead would flatten the position histogram while leaving the older
 * "sort the numbers and pick the third" exploit fully intact — which is exactly how the
 * bracketing bias stayed hidden behind the earlier manual rotations.
 *
 * So this module fixes position. It does NOT fix distractor bracketing; that lives in the
 * generator prompts and in the value-rank half of the audit.
 *
 * Everything else — prose, mixed units, prose dates, label-style numbers — is permuted.
 */

/** Options whose position carries meaning and must not be moved. */
const FIXED_POSITION_OPTION = /\b(all|none|both|neither)\s+of\s+(the\s+)?(above|these)\b/i;

const MONTHS =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

/**
 * Strip a plural inflection from one residue word, so "1 year" and "2 years" compare
 * equal. Deliberately crude: it only has to be *consistent* across the four options of a
 * single question, never linguistically right. A word that singularises oddly still
 * compares equal to itself in its sibling options, which is all that is asked of it.
 */
function singularise(word: string): string {
  if (/ies$/i.test(word)) return word.slice(0, -3) + 'y';
  if (/s$/i.test(word) && !/ss$/i.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * The non-numeric residue of an option, used to decide whether four options share a unit.
 * "$500 million" and "$3 billion" yield "$ million" and "$ billion" — different, so they
 * are not value-comparable, because digit extraction would sort 500 above 3.
 *
 * Two things are normalised away first, because both split a genuine magnitude series
 * into four "different units" and hide it from the bracketing metric entirely:
 *
 *  - **Ordinal suffixes glued to the number.** "1st District" and "22nd District" left a
 *    residue of "st district" against "nd district".
 *  - **Plural inflection.** "1 year" left "year" against "years" for "2 years".
 *
 * Together those two accounted for 47 active questions as of 2026-09-08, and they were
 * not a random 47: ranked anyway they ran 1/22/20/4 — 10.6% at an extreme, against 49.3%
 * for the bank the metric could actually see. The blind spot was selecting for exactly
 * the bracketing bias the metric exists to find.
 */
function unitOf(option: string): string {
  return (
    option
      // The ordinal suffix must be consumed with the digits it is glued to; requiring
      // adjacency keeps "5 the best" from losing its "the".
      .replace(/[0-9][0-9,.]*(?:st|nd|rd|th)?/gi, ' ')
      .match(/[a-z%$+]+/gi) || []
  )
    .map(singularise)
    .filter((w) => w.length > 0)
    .join(' ')
    .toLowerCase()
    .trim();
}

/**
 * A magnitude series drawn from a small fixed real-world domain, where the answer's rank
 * cannot be varied without inventing an implausible option.
 *
 * Term length is the motivating case: legislative terms are 1, 2, 4 or 6 years, so a
 * 2-year answer is structurally rank 2 and no honest distractor sits below "1 year".
 * 16 of the 18 such questions in the bank are rank 2 and none is at an extreme.
 *
 * Sorting those would make position equal rank, pinning the answer to **position B**
 * across the whole bank — exporting a rank bias that content cannot fix into a position
 * bias that did not previously exist. So a bounded series is permuted instead. Nothing is
 * lost by doing so: `magnitudeRank` reads values, never positions, so the audit still
 * measures these questions exactly as before.
 *
 * Deliberately narrow. Whole numbers only, anchored at the domain floor (min ≤ 2) and
 * staying small (max ≤ 12). Counts and short durations of that shape are institutionally
 * fixed; populations, dollars, acres and distances are not, and keep sorting.
 */
function isBoundedSeries(values: number[]): boolean {
  if (!values.every((v) => Number.isInteger(v))) return false;
  return Math.min(...values) <= 2 && Math.max(...values) <= 12;
}

function valueOf(option: string): number | null {
  const m = option.match(/[0-9][0-9,]*(\.[0-9]+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parsed values when the four options form a comparable magnitude series, else null.
 *
 * Excludes two things that cannot be value-compared, both found in asheville-nc:
 * prose dates ("December 5, 1791" extracts to 51791, sorting backwards) and mixed
 * units ("$500 million" against "$3 billion" extracts to 500 vs 3).
 *
 * Known limitation, deliberately not handled here: label-style numbers where the digits
 * are names rather than quantities ("13th Amendment", "District 8"). These parse cleanly
 * and share a unit, so they look like a series. Sorting them is harmless and usually
 * desirable — amendments read naturally in numeric order — but their "rank" is
 * meaningless, so do not read anything into the value-rank metric for a collection that
 * is mostly amendment questions. US Civics is a third label-style.
 */
export function magnitudeValues(options: string[]): number[] | null {
  if (options.length !== 4) return null;
  if (options.some((o) => MONTHS.test(o))) return null;
  if (new Set(options.map(unitOf)).size > 1) return null;
  const values = options.map(valueOf);
  if (values.some((v) => v === null)) return null;
  return values as number[];
}

/**
 * Where the correct value ranks among four numeric options (1 = smallest offered,
 * 4 = largest), or null when the options are not a comparable magnitude series.
 *
 * Used by the collection-level bracketing audit. A single question whose answer sits
 * mid-range is perfectly fine — the defect only exists as a distribution.
 */
export function magnitudeRank(options: string[], correctIndex: number): number | null {
  if (correctIndex < 0 || correctIndex > 3) return null;
  const values = magnitudeValues(options);
  if (!values) return null;
  const correct = values[correctIndex];
  return values.filter((v) => v < correct).length + 1;
}

/** True when an option's position is semantic and the list must be left alone. */
export function hasFixedPositionOption(options: string[]): boolean {
  return options.some((o) => FIXED_POSITION_OPTION.test(o));
}

/** FNV-1a. Any stable string->int would do; this one is short and has no dependencies. */
function hashToPosition(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % 4;
}

export interface PlacedAnswer {
  options: string[];
  correctAnswer: number;
  /** How the position was chosen, for logging. */
  placement: 'sorted' | 'permuted' | 'unchanged';
}

/**
 * Put the correct answer somewhere other than wherever the model happened to leave it.
 *
 * Numeric series are sorted ascending; everything else has the correct option swapped
 * into a slot derived from `seed`. Pass a stable per-question seed (externalId, or the
 * question text when no id exists yet) so the result is deterministic and reproducible —
 * regenerating the same question twice must not move its answer, or reviewing drafts
 * becomes maddening.
 *
 * Position is chosen by hash rather than by a counter, which makes this stateless and
 * safe to call from any number of concurrent generators. The trade-off is that a batch is
 * uniform only in expectation, not exactly: a single 12-question nightly run can come out
 * lumpy. Over a collection's lifetime it converges, and the audit catches it if it
 * doesn't.
 *
 * Returns the input untouched — never throws — for anything malformed or position-
 * sensitive, so a bad generator payload degrades to current behaviour instead of
 * corrupting a question.
 */
export function placeAnswer(
  options: string[],
  correctAnswer: number,
  seed: string
): PlacedAnswer {
  if (!Array.isArray(options) || options.length !== 4) {
    return { options, correctAnswer, placement: 'unchanged' };
  }
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
    return { options, correctAnswer, placement: 'unchanged' };
  }
  if (hasFixedPositionOption(options)) {
    return { options, correctAnswer, placement: 'unchanged' };
  }

  const values = magnitudeValues(options);
  // A bounded series falls through to the permute branch below -- see isBoundedSeries().
  if (values && !isBoundedSeries(values)) {
    // Sort ascending, tie-broken by original index so the result is stable. Track the
    // correct option by its original index, never by its text -- duplicate option text
    // would otherwise silently retarget the answer.
    const order = values
      .map((v, i) => ({ v, i }))
      .sort((a, b) => (a.v - b.v) || (a.i - b.i));
    return {
      options: order.map((o) => options[o.i]),
      correctAnswer: order.findIndex((o) => o.i === correctAnswer),
      placement: 'sorted',
    };
  }

  const target = hashToPosition(seed);
  if (target === correctAnswer) {
    return { options, correctAnswer, placement: 'permuted' };
  }
  const swapped = [...options];
  [swapped[target], swapped[correctAnswer]] = [swapped[correctAnswer], swapped[target]];
  return { options: swapped, correctAnswer: target, placement: 'permuted' };
}
