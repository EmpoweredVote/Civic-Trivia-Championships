/**
 * Single source of truth for question external IDs.
 *
 * Two schemes coexist permanently:
 *   legacy  `<prefix>-<NNN|NNNN>`   e.g. ins-049, wiran-1761   (never rewritten)
 *   new     `<collection-slug>_<NNNN>`  e.g. akron-oh_0001
 *
 * They are told apart by '_'. Verified against the live database 2026-09-29:
 * zero collection slugs and zero existing external_ids contain an underscore,
 * so the discriminator is exact and permanent.
 *
 * VENDORED: a byte-identical copy lives at
 * `C:\Project Test\backend\src\scripts\content-generation\externalIdentity.ts`.
 * That repo has no test runner, so these tests are the only tests. Carry any
 * change across by hand.
 */

export const NEW_EXTERNAL_ID_RE = /^[a-z][a-z0-9-]*_\d{4,}$/;
export const LEGACY_EXTERNAL_ID_RE = /^[a-z]{2,5}-\d{3,4}$/;

/** Federal questions predate every prefix scheme: bare `q001`, no separator. */
export const FEDERAL_EXTERNAL_ID_RE = /^q\d{3}$/;

/** Mint `<slug>_<NNNN>`. Widens past four digits rather than truncating. */
export function mintExternalId(slug: string, seq: number): string {
  if (slug.includes('_')) {
    throw new Error(
      `Collection slug "${slug}" contains an underscore, which is the external-id separator.`
    );
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`External-id sequence must be a positive integer, got ${seq}.`);
  }
  return `${slug}_${String(seq).padStart(4, '0')}`;
}

/**
 * The collection key an external ID belongs to: the slug for new IDs, the
 * prefix for legacy ones. Note a legacy prefix does NOT identify a collection
 * (`ind` is shared by Indiana and Indio CA) — this is for display and for
 * ID-space arithmetic, never for selecting a collection's questions.
 */
export function collectionKeyOf(externalId: string): string {
  if (externalId.includes('_')) return externalId.slice(0, externalId.lastIndexOf('_'));
  const dash = externalId.indexOf('-');
  return dash === -1 ? externalId : externalId.slice(0, dash);
}

export function isLegacyExternalId(externalId: string): boolean {
  return !externalId.includes('_');
}

/**
 * Next sequence number from a `MAX(...)` result. Null/undefined means the
 * collection has no questions yet, so the first mint is 1 — not 0.
 */
export function nextSequence(maxId: string | number | null | undefined): number {
  if (maxId === null || maxId === undefined) return 1;
  const n = typeof maxId === 'number' ? maxId : parseInt(maxId, 10);
  return Number.isFinite(n) && n > 0 ? n + 1 : 1;
}

/**
 * Mint an external id for a locale config, honouring whichever scheme it uses.
 *
 * A config WITH `externalIdPrefix` is legacy and keeps its old shape; one
 * WITHOUT derives from `collectionSlug`.
 *
 * `legacyPad` exists because the legacy widths are genuinely different and must
 * not be unified: THREE digits in the replacement cron and the locale, state and
 * replacement generators; FOUR in the international generators. Each matches ids
 * already in the database, so "tidying" them into one width would mint ids that
 * collide with, or fail to continue, existing sequences.
 *
 * This replaced five hand-copied `mintFor` helpers. Keep it here so the two
 * repos' copies stay byte-identical and the widths stay under test.
 */
export function mintForConfig(
  config: { externalIdPrefix?: string; collectionSlug: string },
  seq: number,
  legacyPad: 3 | 4 = 3,
): string {
  return config.externalIdPrefix
    ? `${config.externalIdPrefix}-${String(seq).padStart(legacyPad, '0')}`
    : mintExternalId(config.collectionSlug, seq);
}
