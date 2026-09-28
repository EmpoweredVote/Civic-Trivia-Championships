import type { LocaleConfig } from './bloomington-in.js';

/**
 * Indio, CA locale configuration for civic trivia question generation.
 *
 * CRITICAL ACCURACY NOTES:
 * - Indio is in Riverside County; the county seat is the city of Riverside -- do NOT
 *   attribute Riverside County government to Indio city government
 * - Indio uses a council-manager form of government: 5-member City Council elected by
 *   district (Districts 1–5). Mayor is NOT directly elected by voters; the council
 *   rotates the mayor role annually among its members.
 * - Coachella Festival IS held at the Empire Polo Club IN INDIO -- it is correct to say
 *   "in Indio." The festival is named after the Coachella Valley, not the city of Coachella.
 * - The city of Coachella is a SEPARATE municipality east of Indio -- do not confuse the two
 * - Stagecoach Festival is also held at the Empire Polo Club in Indio
 * - Date farming heritage: Indio hosts the annual National Date Festival (Riverside County Fair)
 * - Fire service is provided by Riverside County Fire Department -- Indio does NOT have
 *   its own city fire department
 * - School districts: Coachella Valley Unified School District (CVUSD) serves the
 *   eastern portion of Indio; Desert Sands Unified School District (DSUSD) serves the
 *   western/northern portions -- do NOT attribute one district to all of Indio
 * - ALL officeholder questions MUST have expiresAt
 * - No addresses or phone numbers in answer options (quality rule)
 * - Verify state legislators (AD-36 / SD-28) district coverage on leginfo.legislature.ca.gov
 *   before activation
 *
 * CURRENT OFFICEHOLDERS (verify on indio.org before generation):
 * - Mayor: Elaine Holmes (rotates annually; Council selects at its first December meeting)
 * - Mayor Pro Tem: Waymond Fermon (rotates on the same cycle)
 * - Council District 1: VERIFY on indio.org
 * - Council District 2: VERIFY on indio.org
 * - Council District 3: VERIFY on indio.org
 * - Council District 4: VERIFY on indio.org
 * - Council District 5: VERIFY on indio.org
 * - CA Assembly AD-36: Jeff Gonzalez (R), since 2024 -- Eduardo Garcia was TERMED OUT
 * - CA Senate SD-28: Jeff Stone (VERIFY -- may have changed; check leginfo)
 *
 * VOICE GUIDANCE:
 * - Do not confuse the Coachella music festival with the city of Coachella; the festival
 *   is in Indio even though it is named after the valley
 * - Do not say Indio has its own fire department -- fire service is Riverside County
 * - Questions about city council elections should clarify that mayor is not directly elected
 * - Elected-officeholder questions must include expiresAt; aim for 15-30% expiring
 * - Avoid questions about specific street addresses or building phone numbers
 */
export const indioCaConfig: LocaleConfig = {
  locale: 'indio-ca',
  name: 'Indio, CA',
  externalIdPrefix: 'ica',
  collectionSlug: 'indio-ca',
  targetQuestions: 130,
  batchSize: 25,
  overshootFactor: 1.4,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description:
        "Indio council-manager government. 5-member City Council elected by district (Districts 1-5). Mayor rotates annually among council members -- NOT directly elected by voters. City Manager appointed by council. Indio Water Authority (city-operated utility). Mix of structure questions (durable) and current-officeholder questions (expiring, ALL must have expiresAt). Current officeholders listed above -- VERIFY on indio.org.",
    },
    {
      slug: 'civic-history',
      name: 'Civic History',
      description:
        "Incorporated May 16, 1930. Name derived from 'Indian' via Southern Pacific Railroad workers at a water stop. Originally a railroad water station on the SP Desert Line. Cahuilla indigenous people are the original inhabitants of the Coachella Valley. Date palm industry introduced to the valley in the early 1900s -- Indio became the date capital of North America. Agricultural roots in eastern Coachella Valley. Growth from small desert railroad town to a major Inland Empire city and festival destination.",
    },
    {
      slug: 'landmarks-culture',
      name: 'Landmarks & Culture',
      description:
        "Empire Polo Club -- venue for both Coachella Valley Music and Arts Festival AND Stagecoach Festival (both in Indio, named after the Coachella Valley not the city of Coachella). National Date Festival / Riverside County Fairgrounds (annual February event celebrating date harvest). Shields Date Garden (historic date grove and film attraction). Coachella Valley History Museum. Indio Performing Arts Center. Coachella Valley Preserve (nearby natural area). Desert murals and public art throughout downtown Indio.",
    },
    {
      slug: 'local-services',
      name: 'Local Services',
      description:
        "Indio Police Department (city department). Riverside County Fire Department (serves Indio -- NOT a city fire department). SunLine Transit Agency (regional public bus system serving the Coachella Valley). Indio Water Authority (city-operated water and wastewater utility). Coachella Valley Unified School District (CVUSD) and Desert Sands Unified School District (DSUSD) -- both serve parts of Indio, do not conflate. John F. Kennedy Memorial Hospital (major medical facility serving the area).",
    },
    {
      slug: 'economy-development',
      name: 'Economy & Development',
      description:
        "Date farming capital of North America -- Medjool and Deglet Noor dates. Coachella and Stagecoach festivals generate hundreds of millions in annual economic impact for the region. Agriculture: dates, citrus, table grapes in the Coachella Valley. Tourism and hospitality industry. Retail development along Highway 111 corridor. Growing solar energy industry across the Coachella Valley. Indio Fashion Mall and commercial development.",
    },
    {
      slug: 'community-environment',
      name: 'Community & Environment',
      description:
        "Desert climate -- Indio regularly records summer temperatures above 115F (among the hottest cities in the US). Water sources: Colorado River via the Coachella Canal; groundwater managed by Coachella Valley Water District. Salton Sea environmental concerns (nearby -- dust and air quality issues). Coachella Valley groundwater management and water conservation. Environmental justice issues (large Latino community, agricultural worker population). Joshua Tree National Park proximity (eastern gateway). Air quality concerns from Salton Sea dust events.",
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
    // Indio's mayoralty ROTATES: the Council picks the Mayor at its first December meeting
    // each year, so both of these turn over annually. Verified 2026-09-28 against the
    // Indio, California infobox, which lists Holmes as Mayor and Fermon as Mayor Pro Tem.
    { name: 'Elaine Holmes', role: 'Mayor (rotates annually each December)', termEnd: '2026-12-01T00:00:00Z' },
    { name: 'Waymond Fermon', role: 'Mayor Pro Tem (rotates annually each December)', termEnd: '2026-12-01T00:00:00Z' },
    // Eduardo Garcia was TERMED OUT and has not held this seat since 2024. Leaving him here
    // made audit-collection-readiness demand coverage of a former officeholder -- satisfying
    // that warning would have written a stale fact into the bank.
    { name: 'Jeff Gonzalez', role: 'California State Assembly Member', district: 'AD-36', termEnd: '2026-12-07T00:00:00Z' },
  ],

  // Wikipedia-first source URLs per carry-forward rule (Phase 58-02)
  sourceUrls: [
    'https://en.wikipedia.org/wiki/Indio,_California',
    'https://en.wikipedia.org/wiki/Coachella_Valley',
    'https://en.wikipedia.org/wiki/Coachella_(festival)',
    'https://en.wikipedia.org/wiki/Stagecoach_Festival',
    'https://en.wikipedia.org/wiki/National_Date_Festival',
    'https://en.wikipedia.org/wiki/Empire_Polo_Club',
    'https://en.wikipedia.org/wiki/Cahuilla',
    'https://en.wikipedia.org/wiki/SunLine_Transit_Agency',
    'https://www.indio.org/government/city-council',
  ],
};
