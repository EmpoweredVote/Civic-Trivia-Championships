import type { LocaleConfig } from './bloomington-in.js';

/**
 * Los Angeles, California locale configuration for civic trivia question generation.
 * Used by generate-locale-questions.ts to produce the LA collection.
 */
export const losAngelesConfig: LocaleConfig = {
  locale: 'los-angeles-ca',
  name: 'Los Angeles, California',
  externalIdPrefix: 'lac',
  collectionSlug: 'los-angeles-ca',
  targetQuestions: 100,
  batchSize: 25,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description: 'LA city government — mayor, city council (15 districts), departments, and municipal structure',
    },
    {
      slug: 'la-county',
      name: 'LA County Government',
      description: 'Los Angeles County — board of supervisors, county services, and county-level civics',
    },
    {
      slug: 'california-state',
      name: 'California State Government',
      description: 'California state government — governor, legislature, and the ballot propositions system',
    },
    {
      slug: 'civic-history',
      name: 'Civic History',
      description: 'LA founding, incorporation, key civic events, growth, and historical milestones',
    },
    {
      slug: 'local-services',
      name: 'Local Services',
      description: 'LADWP, Metro transit, LAPD, LAFD, and essential city services',
    },
    {
      slug: 'elections-voting',
      name: 'Elections & Voting',
      description: 'Local election process, neighborhood councils, voting districts, and civic participation in LA',
    },
    {
      slug: 'landmarks-culture',
      name: 'Landmarks & Culture',
      description: 'Cultural institutions, notable public spaces, and what makes LA unique',
    },
    {
      slug: 'budget-finance',
      name: 'Budget & Finance',
      description: 'City budget, tax structure, and how LA funds public services',
    },
  ],

  // Target question counts per topic (sums to ~100)
  topicDistribution: {
    'city-government': 15,
    'la-county': 12,
    'california-state': 15,
    'civic-history': 12,
    'local-services': 12,
    'elections-voting': 12,
    'landmarks-culture': 10,
    'budget-finance': 12,
  },

  // Authoritative source URLs for RAG — fetched and parsed before generation
  sourceUrls: [
    // City of Los Angeles
    'https://www.lacity.gov',
    'https://www.lacity.gov/about-la',
    'https://cityclerk.lacity.gov',
    'https://cao.lacity.gov',

    // LA City Council
    'https://council.lacity.gov',

    // LA County
    'https://lacounty.gov',
    'https://bos.lacounty.gov',

    // California State
    'https://www.ca.gov',
    'https://www.gov.ca.gov',
    'https://leginfo.legislature.ca.gov',

    // Key LA Departments
    'https://www.ladwp.com',
    'https://www.metro.net',

    // California Secretary of State (elections)
    'https://www.sos.ca.gov/elections',
    'https://www.lavote.gov',
  ],
};
