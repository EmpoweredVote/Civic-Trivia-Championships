/**
 * The shape the question generators return, and the one sentence the admin UI builds from it.
 *
 * Its own module, importing nothing, so it can be tested. The page it serves cannot be: this
 * repo's vitest lane is node-only by design, and importing ElectionsPage pulls in the theme
 * store, which reads localStorage at module scope. Pure helpers get pulled out here for the
 * same reason `preferUnowned` and `needsTopicRefresh` were pulled out of their services.
 */
export interface QuestionGenerationResult {
  questionsCreated: number;
  /**
   * Questions the model returned that the generator's schema refused, so they were never
   * written (ev-accounts #993). Optional: a backend older than that does not send the field.
   */
  questionsRejected?: number;
  archived: number;
  collectionSlug: string;
  jurisdiction: string;
}

/**
 * ZERO IS THE EXPECTED VALUE, which is why nothing is said at zero. A standing "0 more were
 * refused" trains an admin to skim past the one line that matters on the day it is not zero,
 * and `undefined` — an older backend — must never render as a count.
 *
 * Leads with a space: it is appended to an already-finished sentence.
 */
export function rejectedNote(n: number | undefined): string {
  if (!n || n <= 0) return '';
  return ` ${n} more ${n === 1 ? 'was' : 'were'} refused by the schema and not written.`;
}
