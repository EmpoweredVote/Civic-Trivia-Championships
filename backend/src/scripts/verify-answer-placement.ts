/**
 * verify-answer-placement.ts
 *
 * Self-contained checks for the write-time answer-position guard
 * (services/questionQuality/answerPlacement.ts). No DB, no network, no API spend.
 *
 * Usage:
 *   cd backend && npx tsx src/scripts/verify-answer-placement.ts
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 *
 * Why a script and not a test file: this package has no test runner, and adding one
 * for a single module is more disruption than the coverage is worth. This follows the
 * existing audit- and verify- script convention instead.
 */

import {
  placeAnswer,
  magnitudeRank,
  magnitudeValues,
  hasFixedPositionOption,
} from '../services/questionQuality/answerPlacement.js';

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail?: string): void {
  checks++;
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** The invariant that matters most: the correct answer's TEXT must never change. */
function checkPreservesAnswer(name: string, options: string[], correctAnswer: number): void {
  const before = options[correctAnswer];
  const placed = placeAnswer(options, correctAnswer, 'seed-' + name);
  const after = placed.options[placed.correctAnswer];
  check(`${name}: answer preserved`, before === after, `"${before}" became "${after}"`);
  check(
    `${name}: option set preserved`,
    [...placed.options].sort().join('|') === [...options].sort().join('|'),
    `[${placed.options.join(', ')}]`
  );
}

console.log('\nAnswer placement checks\n');

console.log('Magnitude detection:');
check('plain numbers are a series', magnitudeValues(['8', '10', '12', '15']) !== null);
check('shared unit is a series', magnitudeValues(['2 years', '4 years', '6 years', '8 years']) !== null);
// The singular/plural trap, fixed 2026-09-08: unitOf() now singularises its residue, so
// "1 year" and "2 years" share a unit. This is what pulls mas-006/056/057/089 and cas-003
// back into the bracketing metric.
check(
  'singular/plural IS a series',
  magnitudeValues(['1 year', '2 years', '4 years', '6 years']) !== null
);
check(
  'y/ies plural is a series',
  magnitudeValues(['1 constituency', '2 constituencies', '3 constituencies', '4 constituencies']) !== null
);
// Ordinal suffixes, same fix: the residue was "st district" against "nd district".
check(
  'ordinal suffixes ARE a series',
  magnitudeValues(['1st District', '3rd District', '22nd District', '30th District']) !== null
);
check(
  'singularising must not collapse genuinely different units',
  magnitudeValues(['5 miles', '10 minutes', '15 members', '20 acres']) === null
);
check(
  'mixed units are NOT a series',
  magnitudeValues(['$500 million', '$3 billion', '$1 billion', '$2 billion']) === null
);
check(
  'prose dates are NOT a series',
  magnitudeValues(['July 4, 1776', 'June 15, 1780', 'March 4, 1789', 'May 1, 1790']) === null
);
check('non-numeric is NOT a series', magnitudeValues(['Alice', 'Bob', 'Carol', 'Dave']) === null);

console.log('\nMagnitude rank:');
check('smallest is rank 1', magnitudeRank(['5', '7', '9', '12'], 0) === 1);
check('largest is rank 4', magnitudeRank(['5', '7', '9', '12'], 3) === 4);
check('bracketed middle is rank 3', magnitudeRank(['1776', '1780', '1788', '1791'], 2) === 3);
check('unsorted input still ranks by value', magnitudeRank(['100', '160', '200', '120'], 1) === 3);

console.log('\nSorting (numeric series → position equals rank):');
{
  const placed = placeAnswer(['100 members', '160 members', '200 members', '120 members'], 1, 'q');
  check('sorted ascending', placed.options.join(',') === '100 members,120 members,160 members,200 members');
  check('placement reported as sorted', placed.placement === 'sorted');
  check('position equals value rank', placed.correctAnswer === 2, `got ${placed.correctAnswer}`);
  check('answer text unchanged', placed.options[placed.correctAnswer] === '160 members');
}
{
  // Duplicate option text must not retarget the answer -- the correct option is tracked
  // by original index, never by matching text.
  const placed = placeAnswer(['5', '5', '9', '12'], 1, 'dup');
  check('duplicate text: answer still a 5', placed.options[placed.correctAnswer] === '5');
}

console.log('');
console.log('Bounded series (rank fixed by the world -> permute, do not sort):');
{
  // Legislative terms are 1/2/4/6 years. Sorting would pin a 2-year answer to position B
  // in 16 of the bank's 18 such questions; permuting leaves position free.
  const opts = ['1 year', '2 years', '4 years', '6 years'];
  const placed = placeAnswer(opts, 1, 'mas-006');
  check('bounded series is permuted, not sorted', placed.placement === 'permuted');
  check('answer text unchanged', placed.options[placed.correctAnswer] === '2 years');
  check(
    'option set unchanged',
    [...placed.options].sort().join('|') === [...opts].sort().join('|')
  );
  // The whole point: it stays measurable. magnitudeRank reads values, never positions.
  check('still ranks by value', magnitudeRank(opts, 1) === 2);
}
{
  // Unbounded numeric series must still sort -- the bounded rule has to stay narrow.
  const placed = placeAnswer(['800,000', '1,000,000', '2,250,000', '5,000,000'], 2, 'stlmo-020');
  check('large-magnitude series still sorts', placed.placement === 'sorted');
}
{
  const placed = placeAnswer(['13th Amendment', '14th Amendment', '15th Amendment', '19th Amendment'], 2, 'q058');
  check('label-style ordinals still sort (they read naturally in order)', placed.placement === 'sorted');
}
{
  const placed = placeAnswer(['1 mile', '5 miles', '12.5 miles', '25 miles'], 2, 'stlmo-058');
  check('non-integer series is not bounded', placed.placement === 'sorted');
}

console.log('\nPermuting (prose):');
{
  const opts = ['Council-Manager', 'Strong-Mayor', 'Commission', 'Mayor-Council'];
  const placed = placeAnswer(opts, 0, 'sprmo-001');
  check('placement reported as permuted', placed.placement === 'permuted');
  check('answer text unchanged', placed.options[placed.correctAnswer] === 'Council-Manager');
  check(
    'option set unchanged',
    [...placed.options].sort().join('|') === [...opts].sort().join('|')
  );
}
{
  // Determinism: same seed must give the same slot, or draft review churns.
  const a = placeAnswer(['W', 'X', 'Y', 'Z'], 0, 'stable-seed');
  const b = placeAnswer(['W', 'X', 'Y', 'Z'], 0, 'stable-seed');
  check('deterministic for a given seed', a.correctAnswer === b.correctAnswer);
}

console.log('\nRefusals (must return input untouched):');
{
  const fixed = ['Red', 'Blue', 'Green', 'All of the above'];
  check('detects fixed-position option', hasFixedPositionOption(fixed));
  const placed = placeAnswer(fixed, 3, 's');
  check('"all of the above" left in place', placed.correctAnswer === 3 && placed.placement === 'unchanged');
}
{
  const three = ['A', 'B', 'C'];
  const placed = placeAnswer(three, 0, 's');
  check('wrong option count untouched', placed.placement === 'unchanged' && placed.options === three);
}
{
  const placed = placeAnswer(['A', 'B', 'C', 'D'], 7, 's');
  check('out-of-range index untouched', placed.placement === 'unchanged' && placed.correctAnswer === 7);
}
{
  const placed = placeAnswer(['A', 'B', 'C', 'D'], -1, 's');
  check('negative index untouched', placed.placement === 'unchanged');
}

console.log('\nAnswer + option-set preservation across shapes:');
checkPreservesAnswer('numeric-series', ['8', '10', '12', '15'], 1);
checkPreservesAnswer('prose', ['Alpha', 'Beta', 'Gamma', 'Delta'], 0);
checkPreservesAnswer('mixed-units', ['$500 million', '$3 billion', '$1 billion', '$2 billion'], 0);
checkPreservesAnswer('prose-dates', ['July 4, 1776', 'June 15, 1780', 'March 4, 1789', 'May 1, 1790'], 1);
checkPreservesAnswer('label-style', ['13th Amendment', '14th Amendment', '15th Amendment', '19th Amendment'], 2);

console.log('\nDistribution over a realistic batch:');
{
  // 400 prose questions with pipeline-shaped ids, all arriving at position 0 as the
  // generators produce them. Hash placement is uniform only in expectation, so this
  // asserts a band, not an exact split.
  const counts = [0, 0, 0, 0];
  const N = 400;
  for (let i = 1; i <= N; i++) {
    const id = `xyz-${String(i).padStart(3, '0')}`;
    const placed = placeAnswer(['One', 'Two', 'Three', 'Four'], 0, id);
    counts[placed.correctAnswer]++;
  }
  const worst = (100 * Math.max(...counts)) / N;
  console.log(`    A/B/C/D = ${counts.join(' / ')} of ${N}; best guess ${worst.toFixed(1)}%`);
  check('no position dominates', worst < 32, `best guess was ${worst.toFixed(1)}%`);
  check('every position used', counts.every((c) => c > 0));
  check(
    'beats the pre-guard baseline of 100%',
    worst < 40,
    'guard is not spreading answers'
  );
}

console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
console.log('All answer-placement checks passed.\n');
