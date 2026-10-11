import type { LocaleConfig } from './bloomington-in.js';

/**
 * Santa Monica, CA locale configuration for civic trivia question generation.
 *
 * CRITICAL ACCURACY NOTES:
 * - Santa Monica is its own independent city -- NOT part of Los Angeles city government
 *   - Use SMPD (Santa Monica Police Department), NOT LAPD
 *   - Use SMMUSD (Santa Monica-Malibu Unified School District), NOT LAUSD
 *   - Use Big Blue Bus (city transit), NOT LA Metro / LACMTA
 *   - SM city council is at-large -- NOT LA City Council districts
 * - Mayor is elected annually by City Council members, NOT directly by voters
 * - City Attorney and City Clerk are separately elected positions (notable civic fact)
 * - Route 66 western terminus: Santa Monica -- the pier sign is the cultural endpoint
 * - Questions must reflect governance and civic identity, NOT tourist beach trivia
 * - LA appears only as geographic context ("in LA County"); do not attribute county government to city
 * - ALL officeholder questions MUST have expiresAt -- verify termEnd dates during curation
 * - No addresses or phone numbers in answer options (quality rule)
 * - Santa Monica is AD-51 and SD-24. It is NOT SD-26: that is Maria Elena Durazo's
 *   central/East LA district, and this file asserted it until 2026-10-11, which put a
 *   false 'Durazo represents Santa Monica' question into the live bank (smo-413).
 *
 * CURRENT OFFICEHOLDERS:
 * - Mayor: Caroline Torosis (term ends 2026-12-01)
 * - Mayor Pro Tem / Council: Jesse Zwick (term ends 2026-12-01)
 * - Council Member: Lana Negrete (term ends 2026-12-01)
 * - Council Member: Ellis Raskin (term ends 2028-12-01)
 * - City Attorney: Heidi von Tongeln (APPOINTED by the Council 2026-03-11; no fixed term,
 *   so the date below is a re-check horizon, not an expiry. Douglas Sloan, who this file
 *   named until 2026-10-11, resigned effective 2025-08-31.)
 * - CA Assembly AD-51: Rick Chavez Zbur (term ends 2026-12-07)
 * - CA Senate SD-24: Ben Allen (term ends 2026-12-07; termed out at the 2026 election)
 *
 * APPOINTED OFFICERS -- the part of this roster no election moves, and the backbone of the
 * collection's expiring tier (every elected body here was on the 2026-11-03 ballot):
 * - City Manager: Oliver Chi (from July 2025)
 * - Chief of Police: Darrick Jacob (sworn in 2026-01-14)
 * - Director of Public Works: Christopher Dishlip (from 2026-04-06)
 * - SMMUSD Superintendent: Antonio M. Shelton, Ed.D. (from 2023-07-01)
 */
export const santaMonicaCaConfig: LocaleConfig = {
  locale: 'santa-monica-ca',
  name: 'Santa Monica, CA',
  externalIdPrefix: 'smo',
  collectionSlug: 'santa-monica-ca',
  targetQuestions: 130,
  batchSize: 25,
  overshootFactor: 1.4,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description:
        "Santa Monica council-manager government. 7-member at-large City Council, staggered 4-year terms. Mayor elected annually by council (NOT directly by voters). City Manager appointed by council. City Attorney and City Clerk are separately elected positions. ALL officeholder questions MUST have expiresAt. Current officeholders listed in officeholders array above. Mix of structure questions (durable) and current-officeholder questions (expiring).",
    },
    {
      slug: 'civic-history',
      name: 'Civic History',
      description:
        "Incorporated November 30, 1886. Named after Saint Monica. Originally Rancho San Vicente y Santa Monica land grant. John P. Jones laid out town 1875. Annexation by LA refused -- Santa Monica remained independent (this is a key civic fact). 1984 Olympic marathon finish line. 2028 Olympic venues planned. Tongva indigenous territory (original inhabitants).",
    },
    {
      slug: 'landmarks-culture',
      name: 'Landmarks & Culture',
      description:
        "Santa Monica Pier (opened 1909, owned/operated by City of SM, western Route 66 terminus, Pacific Park amusement park, SM Pier Aquarium). Third Street Promenade (pedestrian shopping district). Palisades Park (bluffs overlooking ocean). Santa Monica Place (mall). Civic Auditorium. Bergamot Station arts complex (former Red Car terminus). Questions should reflect civic/cultural significance, NOT tourist trivia.",
    },
    {
      slug: 'local-services',
      name: 'Local Services',
      description:
        "SMPD (Santa Monica Police Department -- independent from LAPD). Big Blue Bus (city-operated transit -- NOT LA Metro/LACMTA). SMFD (Santa Monica Fire Department). SM Public Library system. Santa Monica Airport (closed, converting to park -- Great Park). Heal the Bay (environmental nonprofit headquartered in SM).",
    },
    {
      slug: 'economy-development',
      name: 'Economy & Development',
      description:
        "Silicon Beach tech hub (major tech companies located in SM). Tourism/hospitality industry. Rent control (strong since 1979, one of the earliest and most protective in California). Third Street Promenade retail district. Major employers. Development and zoning history.",
    },
    {
      slug: 'community-environment',
      name: 'Community & Environment',
      description:
        "Santa Monica Bay and beach environment. Heal the Bay water quality monitoring. Sustainable City Plan (SM has been a sustainability leader since the 1990s). SMMUSD (Santa Monica-Malibu Unified School District -- NOT LAUSD). LGBTQ+ community. Tongva indigenous heritage. Environmental initiatives and climate action.",
    },
  ],

  // Target question percentages per topic (sums to 100)
  topicDistribution: {
    'city-government': 22,
    'civic-history': 18,
    'landmarks-culture': 18,
    'local-services': 15,
    'economy-development': 15,
    'community-environment': 12,
  },

  officeholders: [
    { name: 'Caroline Torosis', role: 'Mayor', termEnd: '2026-12-01T00:00:00Z' },
    { name: 'Jesse Zwick', role: 'City Council Member / Mayor Pro Tem', termEnd: '2026-12-01T00:00:00Z' },
    { name: 'Lana Negrete', role: 'City Council Member', termEnd: '2026-12-01T00:00:00Z' },
    { name: 'Ellis Raskin', role: 'City Council Member', termEnd: '2028-12-01T00:00:00Z' },
    { name: 'Heidi von Tongeln', role: 'City Attorney', termEnd: '2028-12-01T00:00:00Z' },
    { name: 'Rick Chavez Zbur', role: 'California State Assembly Member', district: 'AD-51', termEnd: '2026-12-07T00:00:00Z' },
    { name: 'Ben Allen', role: 'California State Senator', district: 'SD-24', termEnd: '2026-12-07T00:00:00Z' },
    // Appointed, not elected: termEnd is a re-check horizon. Staggered on purpose, so the
    // tier cannot die on one date the way the elected tier does every December.
    { name: 'Oliver Chi', role: 'City Manager', termEnd: '2028-07-01T00:00:00Z' },
    { name: 'Darrick Jacob', role: 'Chief of Police', termEnd: '2028-01-01T00:00:00Z' },
    { name: 'Christopher Dishlip', role: 'Director of Public Works', termEnd: '2028-04-01T00:00:00Z' },
    { name: 'Antonio Shelton', role: 'SMMUSD Superintendent', termEnd: '2027-07-01T00:00:00Z' },
  ],

  // Wikipedia-first source URLs per carry-forward rule (Phase 58-02)
  sourceUrls: [
    'https://en.wikipedia.org/wiki/Santa_Monica,_California',
    'https://en.wikipedia.org/wiki/Santa_Monica_Pier',
    'https://en.wikipedia.org/wiki/Third_Street_Promenade',
    'https://en.wikipedia.org/wiki/Big_Blue_Bus',
    'https://en.wikipedia.org/wiki/Santa_Monica-Malibu_Unified_School_District',
    'https://en.wikipedia.org/wiki/Bergamot_Station',
    'https://en.wikipedia.org/wiki/Santa_Monica_Civic_Auditorium',
    'https://en.wikipedia.org/wiki/Santa_Monica_Airport',
    'https://en.wikipedia.org/wiki/Tongva',
    'https://www.smgov.net/departments/council/content.aspx?id=13705',
  ],
};
