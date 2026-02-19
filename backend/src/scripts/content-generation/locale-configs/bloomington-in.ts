/**
 * Bloomington, Indiana locale configuration for civic trivia question generation.
 * Used by generate-locale-questions.ts to produce the Bloomington collection.
 */

export interface TopicCategory {
  slug: string;
  name: string;
  description: string;
}

export interface LocaleConfig {
  locale: string;
  name: string;
  externalIdPrefix: string;
  collectionSlug: string;
  targetQuestions: number;
  batchSize: number;
  topicCategories: TopicCategory[];
  topicDistribution: Record<string, number>;
  sourceUrls: string[];
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
};
