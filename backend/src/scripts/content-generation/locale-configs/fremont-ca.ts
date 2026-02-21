import type { LocaleConfig } from './bloomington-in.js';

/**
 * Fremont, California locale configuration for civic trivia question generation.
 * Used by generate-locale-questions.ts to produce the Fremont collection.
 *
 * CONTEXT: Fremont as "five towns, one city"
 * - Consolidated in 1956 from Centerville, Niles, Irvington, Mission San José, and Warm Springs
 * - Six-district city council (each district elects one council member)
 * - Diverse multicultural identity including Little Kabul (Afghan community)
 * - Ohlone land acknowledgment context: Located on traditional Ohlone territory
 * - Economic narrative: Tesla/NUMMI dual story (manufacturing legacy to EV future)
 *
 * DISAMBIGUATION NOTES:
 * - Mission San Jose: Distinguish between "Mission San Jose (historic mission)" (1797 Spanish mission)
 *   and "Mission San Jose district" (modern neighborhood)
 * - Five towns: Always refer to pre-consolidation communities as "five towns" or list individually
 * - NUMMI/Tesla: Cover both economic impact (jobs, tax revenue) AND land use (zoning, environmental)
 *
 * ELECTION SCHEDULE:
 * - Mayor: 4-year terms, next election November 3, 2026
 * - City Council: 4-year terms, staggered by district
 * - Alameda County Board of Supervisors: 4-year terms, next election November 3, 2026
 * - Sources: fremont.gov/government/election-information, acvote.alamedacountyca.gov
 */
export const fremontConfig: LocaleConfig = {
  locale: 'fremont-ca',
  name: 'Fremont, California',
  externalIdPrefix: 'fre',
  collectionSlug: 'fremont-ca',
  targetQuestions: 100,
  batchSize: 25,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description: 'Fremont city government — mayor, six-district city council, city manager, departments, and municipal structure',
    },
    {
      slug: 'alameda-county',
      name: 'Alameda County & Regional Agencies',
      description: 'Alameda County government, board of supervisors, BART, AC Transit, and Bay Area regional agencies',
    },
    {
      slug: 'california-state',
      name: 'California State Government',
      description: 'California state government — governor, legislature, and the ballot propositions system',
    },
    {
      slug: 'civic-history',
      name: 'Civic History',
      description: 'Five-town consolidation (1956), Ohlone land acknowledgment, Mission San Jose founding, and key civic milestones',
    },
    {
      slug: 'local-services',
      name: 'Local Services',
      description: 'City utilities, parks and recreation, police and fire departments, planning, and municipal services',
    },
    {
      slug: 'elections-voting',
      name: 'Elections & Voting',
      description: 'District-based elections, voting process, Alameda County Registrar, and civic participation in Fremont',
    },
    {
      slug: 'landmarks-culture',
      name: 'Landmarks & Culture',
      description: 'Mission San Jose district, Little Kabul, Mission Peak, multicultural identity, and what makes Fremont unique',
    },
    {
      slug: 'budget-finance',
      name: 'Budget & Finance',
      description: 'City budget, tax structure, Tesla economic impact, Measure E, NUMMI redevelopment, and public finance',
    },
  ],

  // Target question counts per topic (sums to 100)
  topicDistribution: {
    'city-government': 10,
    'alameda-county': 10,
    'california-state': 10,
    'civic-history': 20, // History heavy per user decision
    'local-services': 10,
    'elections-voting': 10,
    'landmarks-culture': 18, // Culture heavy per user decision
    'budget-finance': 12, // Above standard for Tesla/NUMMI story
  },

  // Authoritative source URLs for RAG — fetched and parsed before generation
  sourceUrls: [
    // City of Fremont
    'https://www.fremont.gov',
    'https://www.fremont.gov/government',
    'https://www.fremont.gov/government/mayor-city-council',
    'https://www.fremont.gov/about-city-government',
    'https://www.fremont.gov/government/departments',
    'https://www.fremont.gov/about',
    'https://www.fremont.gov/about/our-story',
    'https://www.fremont.gov/government/election-information',
    'https://fremontpolice.gov',

    // Alameda County
    'https://bos.alamedacountyca.gov',
    'https://www.acgov.org',
    'https://www.acgov.org/government/elected.htm',
    'https://acvote.alamedacountyca.gov',

    // Regional Agencies
    'https://www.bart.gov',
    'https://www.bart.gov/about/planning/alameda',
    'https://www.actransit.org',

    // California State
    'https://www.ca.gov',
    'https://www.gov.ca.gov',
    'https://leginfo.legislature.ca.gov',
    'https://www.sos.ca.gov/elections',
  ],
};

/**
 * ELECTION SCHEDULE NOTES:
 *
 * Mayor: 4-year terms, next election November 3, 2026
 * City Council: 4-year terms, staggered by district (6 districts)
 * Alameda County Board of Supervisors: 4-year terms, next election November 3, 2026
 *
 * Sources:
 * - https://www.fremont.gov/government/election-information
 * - https://acvote.alamedacountyca.gov
 */

/**
 * DISAMBIGUATION RULES:
 *
 * Mission San Jose:
 * - "Mission San Jose (historic mission)" = 1797 Spanish mission (Mission San José de Guadalupe)
 * - "Mission San Jose district" = Modern neighborhood/community within Fremont
 *
 * Five Towns:
 * - Always refer to: Centerville, Niles, Irvington, Mission San José, Warm Springs
 * - Consolidated in 1956 to form City of Fremont
 *
 * NUMMI/Tesla:
 * - Cover BOTH economic impact (jobs created, tax revenue, wages) AND land use aspects
 *   (zoning changes, environmental review, redevelopment planning)
 * - NUMMI = New United Motor Manufacturing Inc. (1984-2010, GM-Toyota joint venture)
 * - Tesla = Took over NUMMI facility in 2010, now major employer and tax base
 */
