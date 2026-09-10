export const CIVIC_FACTS = [
  'The Bill of Rights added the first 10 amendments in 1791.',
  'Every state gets at least 3 electoral votes, no matter its population.',
  'The Supreme Court has sat with 9 justices since 1869.',
  'The 26th Amendment lowered the voting age to 18 in 1971.',
  'Congress has two chambers: the House and the Senate.',
  'A presidential veto can be overridden by a two-thirds vote in Congress.',
  'Local elections often decide your school board, mayor, and ballot measures.',
  'The First Amendment protects speech, press, religion, assembly, and petition.',
] as const;

/**
 * One fact for the whole session, chosen at module load. ev-landing deals its quote pool once
 * per page load (ev-quotes.js:204-208) and a reader keeps his line for the visit; a fact that
 * changed on every hover made the reader feel like a slot machine rather than someone with
 * something to say. New fact on refresh, not on re-hover.
 */
const SESSION_FACT = CIVIC_FACTS[Math.floor(Math.random() * CIVIC_FACTS.length)];

export function sessionFact(): string {
  return SESSION_FACT;
}
