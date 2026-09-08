/**
 * Bloomington, Indiana locale configuration for civic trivia question generation.
 * Used by generate-locale-questions.ts to produce the Bloomington collection.
 */

export interface TopicCategory {
  slug: string;
  name: string;
  description: string;
}

export interface OfficeholderEntry {
  name: string;       // Full name as it should appear in questions
  role: string;       // Role label, e.g. "Mayor", "City Council, Ward 3"
  termEnd: string;    // ISO 8601 date string, e.g. "2029-06-01T00:00:00Z"
  district?: string;  // Optional plain text — prompt context only
}

export interface LocaleConfig {
  locale: string;
  name: string;
  externalIdPrefix: string;
  collectionSlug: string;
  targetQuestions: number;
  batchSize: number;
  overshootFactor?: number; // Generate more than target, curate down later. Default 1.0
  topicCategories: TopicCategory[];
  topicDistribution: Record<string, number>;
  sourceUrls: string[];
  officeholders?: OfficeholderEntry[];
}

/**
 * Extended config for International collections.
 * Required shape for any international locale config file (Phase 77+).
 * Extends LocaleConfig with RSS pipeline and pool management fields.
 */
export interface InternationalLocaleConfig extends LocaleConfig {
  /** RSS feed URLs for this collection (replaces sourceUrls for international) */
  rssFeeds: string[];
  /** Default confidence tier assigned to generated questions */
  confidenceTierDefault: 'high' | 'medium' | 'low';
  /** Trigger generation when active question count drops below this */
  poolFloor: number;
  /** Stop generating when active count reaches this target */
  poolTarget: number;
  /** Hard cap — archive oldest questions above this count before generating */
  poolCeiling: number;
}

export const bloomingtonConfig: LocaleConfig = {
  locale: 'bloomington-in',
  name: 'Bloomington, Indiana',
  externalIdPrefix: 'bli',
  collectionSlug: 'bloomington-in',
  targetQuestions: 100,
  batchSize: 25,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description: 'Bloomington city government — mayor, city council, departments, and municipal services',
    },
    {
      slug: 'monroe-county',
      name: 'Monroe County',
      description: 'Monroe County government — commissioners, county services, and county-level civics',
    },
    {
      slug: 'indiana-state',
      name: 'Indiana State Government',
      description: 'Indiana state government — governor, general assembly, and state agencies',
    },
    {
      slug: 'civic-history',
      name: 'Civic History',
      description: 'Bloomington founding, key civic events, IU\'s civic role, and historical milestones',
    },
    {
      slug: 'local-services',
      name: 'Local Services',
      description: 'City utilities, parks and recreation, public safety, and municipal services',
    },
    {
      slug: 'elections-voting',
      name: 'Elections & Voting',
      description: 'Local election process, voting districts, and civic participation in Bloomington',
    },
    {
      slug: 'landmarks-culture',
      name: 'Landmarks & Culture',
      description: 'Cultural institutions, notable places, and what makes Bloomington unique',
    },
    {
      slug: 'budget-finance',
      name: 'Budget & Finance',
      description: 'City budget, tax structure, and how Bloomington funds public services',
    },
  ],

  // Target question counts per topic (sums to ~100)
  topicDistribution: {
    'city-government': 15,
    'monroe-county': 12,
    'indiana-state': 15,
    'civic-history': 12,
    'local-services': 12,
    'elections-voting': 12,
    'landmarks-culture': 10,
    'budget-finance': 12,
  },

  // Authoritative source URLs for RAG — fetched and parsed before generation
  sourceUrls: [
    // City of Bloomington
    'https://bloomington.in.gov',
    'https://bloomington.in.gov/city-council',
    'https://bloomington.in.gov/mayor',
    'https://bloomington.in.gov/utilities',
    'https://bloomington.in.gov/parks',
    'https://bloomington.in.gov/police',
    'https://bloomington.in.gov/fire',
    'https://bloomington.in.gov/planning',

    // Monroe County
    'https://www.co.monroe.in.us',
    'https://www.co.monroe.in.us/government/county-commissioners',
    'https://www.co.monroe.in.us/government/county-council',

    // Indiana State Government
    'https://www.in.gov',
    'https://www.in.gov/gov',
    'https://iga.in.gov',

    // Indiana Election Division
    'https://www.in.gov/sos/elections',
  ],

  /**
   * Current officeholders, for generating expiring current-officeholder questions.
   *
   * Verified 2026-09-08 against the city's own pages (bloomington.in.gov/council and
   * /offices) and the BPD page — not from memory or inference. Bloomington had no
   * officeholder list at all before this, which is why its expiring-question ratio sat
   * at 5.4% against a 15-30% target: the generator had nothing to write these from.
   *
   * All eleven elected terms run concurrently from 2024-01-01 and end 2027-12-31 —
   * Indiana holds municipal elections in odd years, so the next Bloomington municipal
   * election is 2027, NOT 2026. (A prior generated pack assumed a 2026 mayoral race and
   * produced fifteen questions on a race that does not exist; those were archived
   * 2026-09-08. Do not reintroduce that premise.)
   *
   * DELIBERATELY NOT ENCODED: Isak Nti Asare is Council President, Sydney Zulich Vice
   * President and Courtney Daily Parliamentarian as of 2026-09-08. Those titles are held
   * by seat holders but rotate independently of the four-year seat term, so encoding them
   * as `role` would generate questions that read as valid until 2027 while going stale far
   * sooner. If leadership questions are wanted, give them their own entries with a term
   * end matching the leadership year, not the seat.
   */
  officeholders: [
    { name: 'Kerry Thomson', role: 'Mayor', termEnd: '2027-12-31T00:00:00Z' },
    { name: 'Nicole Bolden', role: 'City Clerk', termEnd: '2027-12-31T00:00:00Z' },

    // Six district seats, numbered I-VI on the city's own pages.
    { name: 'Isabel Piedmont-Smith', role: 'Common Council Member', district: 'District I', termEnd: '2027-12-31T00:00:00Z' },
    { name: 'Kate Rosenbarger', role: 'Common Council Member', district: 'District II', termEnd: '2027-12-31T00:00:00Z' },
    { name: 'Hopi Stosberg', role: 'Common Council Member', district: 'District III', termEnd: '2027-12-31T00:00:00Z' },
    { name: 'Dave Rollo', role: 'Common Council Member', district: 'District IV', termEnd: '2027-12-31T00:00:00Z' },
    { name: 'Courtney Daily', role: 'Common Council Member', district: 'District V', termEnd: '2027-12-31T00:00:00Z' },
    { name: 'Sydney Zulich', role: 'Common Council Member', district: 'District VI', termEnd: '2027-12-31T00:00:00Z' },

    // Three at-large seats.
    { name: 'Isak Nti Asare', role: 'Common Council Member', district: 'At-Large', termEnd: '2027-12-31T00:00:00Z' },
    { name: 'Matt Flaherty', role: 'Common Council Member', district: 'At-Large', termEnd: '2027-12-31T00:00:00Z' },
    { name: 'Andy Ruff', role: 'Common Council Member', district: 'At-Large', termEnd: '2027-12-31T00:00:00Z' },

    // Appointed, not elected — no fixed term. The date is a re-verification horizon
    // aligned to the elected cycle, not a term expiry.
    { name: 'Michael Diekhoff', role: 'Chief of Police', termEnd: '2027-12-31T00:00:00Z' },
  ],
};
