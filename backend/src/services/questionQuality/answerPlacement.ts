/**
 * Answer placement — the write-time guard against answer-position collapse.
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
 * rather than permuted. That is deliberate: for a sorted series the answer's display
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
 * The non-numeric residue of an option, used to decide whether four options share a unit.
 * "$500 million" and "$3 billion" yield "$ million" and "$ billion" — different, so they
 * are not value-comparable, because digit extraction would sort 500 above 3.
 */
function unitOf(option: string): string {
  return (option.replace(/[0-9][0-9,.]*/g, ' ').match(/[a-z%$+]+/gi) || [])
    .join(' ')
    .toLowerCase()
    .trim();
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
  if (values) {
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
