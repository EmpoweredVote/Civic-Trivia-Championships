export interface CollectionSummary {
  id: number;
  name: string;
  slug: string;
  description: string;
  themeColor: string;        // 7-char hex e.g. '#1E3A8A'
  questionCount: number;
  tier: 'federal' | 'state' | 'city' | 'international';
  /**
   * Editorial shelf flag, orthogonal to `tier` — a collection keeps its real taxonomy and is
   * additionally promoted.
   *
   * OPTIONAL ON PURPOSE, AND IT STAYS OPTIONAL. This static site and the API that feeds it
   * deploy independently, so any release can briefly read a payload written by the other
   * side's previous version. Every read goes through `isFeatured()`, which treats a missing
   * field as "not featured" — the shelf stays empty rather than rendering against undefined.
   */
  featured?: boolean;
  localeName?: string;       // e.g. "North Carolina", "United States"
  localeCode?: string;       // e.g. "NC", "US"
  latestQuestionAt?: string | null;
}
