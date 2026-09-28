import type { LocaleConfig } from './bloomington-in.js';

/**
 * Phoenix, AZ locale configuration for civic trivia question generation.
 *
 * CRITICAL ACCURACY NOTES:
 * - Phoenix uses a COUNCIL-MANAGER form of government — the mayor does NOT appoint the city
 *   manager; the full City Council does. The mayor is elected at-large but is primarily a
 *   legislative/ceremonial leader, not an executive.
 * - Do NOT confuse Phoenix city government with Maricopa County government. The county has
 *   a separate Board of Supervisors and Sheriff.
 * - Do NOT confuse Phoenix with nearby cities (Scottsdale, Tempe, Mesa, Glendale, Chandler).
 *   ASU's main campus is in TEMPE, not Phoenix proper.
 * - Phoenix has 8 council districts + 1 at-large mayor = 9 total council seats.
 * - Arizona Coyotes (NHL) relocated/folded in 2024 — avoid present-tense questions about them.
 * - Chase Field's retractable roof originally opened over natural grass (1998) but switched
 *   to artificial turf in 2019. Phrase history questions accurately.
 * - ALL officeholder questions MUST have expiresAt set.
 * - No addresses or phone numbers in answer options (quality rule).
 *
 * CURRENT OFFICEHOLDERS (as of 2026):
 * - Mayor: Kate Gallego (term ends April 16, 2029)
 * - District 1: Ann O'Brien (term ends April 16, 2029)
 * - District 2: Jim Waring (term ends April 19, 2027)
 * - District 3: Debra Stark, Vice Mayor (term ends April 16, 2029)
 * - District 4: Laura Pastor (term ends April 19, 2027)
 * - District 5: Betty Guardado (term ends April 16, 2029)
 * - District 6: Kevin Robinson (term ends April 19, 2027)
 * - District 7: Anna Hernandez (term ends April 16, 2029)
 * - District 8: Kesha Hodge Washington (term ends April 19, 2027)
 * - City Manager: Ed Zuercher (returned for second stint, December 2025)
 *
 * EXPIRATION GUIDANCE:
 * - Terms ending 2027: set expiresAt to 2027-04-01T00:00:00Z
 * - Terms ending 2029: set expiresAt to 2029-04-01T00:00:00Z
 */
export const phoenixAzConfig: LocaleConfig = {
  locale: 'phoenix-az',
  name: 'Phoenix, AZ',
  externalIdPrefix: 'phxaz',
  collectionSlug: 'phoenix-az',
  targetQuestions: 130,
  batchSize: 25,
  overshootFactor: 1.4,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description: `Phoenix uses a council-manager form of government, adopted by voters in 1913 — making it one
      of the earliest major U.S. cities to do so. The City Council has 9 members: the mayor (elected at-large,
      4-year term, max 2 consecutive terms) and 8 district councilmembers (4-year terms, max 3 consecutive terms).
      The full council appoints a professional City Manager to oversee daily operations. All elections are
      non-partisan. Current mayor: Kate Gallego (62nd mayor, term ends April 2029). Districts 1, 3, 5, 7
      elected in presidential years; Districts 2, 4, 6, 8 in off-years. The city was incorporated February 25,
      1881 when Governor Fremont signed the Phoenix Charter Bill. The city's first mayor was John T. Alsap,
      elected May 3, 1881 with 127 votes. Jeff Barton was Phoenix's first African American city manager
      (retired November 2025). Current city manager: Ed Zuercher (second stint, December 2025).
      Avoid questions that imply the mayor has executive authority over daily operations.`,
    },
    {
      slug: 'founding-history',
      name: 'Founding & History',
      description: `Phoenix was founded on the ruins of a Hohokam civilization that built 135+ miles of canals
      in the Salt River Valley (ca. AD 500–1450). In 1867, Civil War veteran Jack Swilling noticed the ancient
      canals and founded the Swilling Irrigation Canal Company. Englishman Darrell Duppa suggested the name
      "Phoenix" based on the Greek myth of the phoenix rising from ashes. The city was officially recognized
      May 4, 1868. The townsite (320 acres) was purchased for $50 in October 1870. Phoenix became the Arizona
      Territorial Capital on February 4, 1889 (moved from Prescott). Arizona became the 48th state on
      February 14, 1912 (Valentine's Day), making Phoenix the state capital. The Territorial/State Capitol
      building was completed in 1901. Key infrastructure: Roosevelt Dam on the Salt River was dedicated in
      1911 by former President Theodore Roosevelt — at the time one of the world's largest masonry dams and the
      first federally funded flood-control project to incorporate hydroelectric power. The Salt River Project
      irrigated over 250,000 surrounding acres. Phoenix adopted the council-manager government form in October
      1913. The city flag (maroon field, white phoenix bird) was adopted in 1990.`,
    },
    {
      slug: 'landmarks-culture',
      name: 'Landmarks & Culture',
      description: `Phoenix's most iconic landmarks include Camelback Mountain (2,704 ft summit, named for its
      camel profile, became a city park in 1968); the Heard Museum (founded 1929 by Dwight B. Heard and Maie
      Bartlett Heard, focuses exclusively on Native American art from a first-person perspective, 40,000+ items);
      Desert Botanical Garden (founded 1939, 55 acres in Papago Park, dedicated to Sonoran Desert plants);
      and S'edav Va'aki Museum (a 1,500-year-old Hohokam archaeological site near Sky Harbor, operated by the
      city since 1929). Papago Park straddles Phoenix and Tempe and contains Hunt's Tomb — the pyramid tomb of
      George W.P. Hunt, Arizona's first governor. The park was also the site of Camp Papago Park, where the
      Great Papago Escape occurred on December 23, 1944: 25 German POWs escaped via a 178-foot tunnel (the
      largest Axis POW escape from any American facility in WWII). All 25 were recaptured. Saint Mary's Basilica
      (founded 1880) is the oldest Roman Catholic church in Phoenix.`,
    },
    {
      slug: 'infrastructure-water',
      name: 'Infrastructure & Water',
      description: `Phoenix Sky Harbor International Airport (IATA: PHX) was built by J. Parker Van Zandt in
      1928; first passenger service ran February 23, 1929. The City of Phoenix purchased Sky Harbor on July 16,
      1935 for exactly $100,000. Today it covers 3,400 acres, has 3 runways (longest 11,489 ft), handles
      140,000+ passengers daily, and generates $44.3 billion in economic impact. The airport is located
      3 miles east of downtown Phoenix. Phoenix's water story centers on the Salt River Project (authorized
      1903 as one of the first five projects under the 1902 National Reclamation Act). Roosevelt Dam was built
      1905–1911 and dedicated by former President Theodore Roosevelt. Phoenix's urban growth depended on
      re-digging and extending the ancient Hohokam canal system. The Salt River Project irrigated over 250,000
      acres. Chase Field (opened March 31, 1998) was the first MLB stadium in the U.S. built with a retractable
      roof designed to cover natural grass — the roof uses two 200-horsepower motors and can open or close in
      just over 4 minutes.`,
    },
    {
      slug: 'economy-innovation',
      name: 'Economy & Innovation',
      description: `Phoenix is a major semiconductor manufacturing hub. Motorola opened a semiconductor research
      lab in Phoenix in 1949 (just 2 years after the transistor was invented), and by 1955 produced the world's
      first commercially available high-power germanium transistor (2N176) for car radios. TSMC (Taiwan
      Semiconductor Manufacturing Company) chose Phoenix for its first advanced U.S. fab — an investment that
      grew to $165 billion, representing the largest foreign direct investment in a greenfield project in American
      history. Greater Phoenix is the 4th largest U.S. metro for semiconductor manufacturing employment, with
      60+ semiconductor company expansions since 2020. Phoenix is the 5th largest city in the United States
      (behind New York, Los Angeles, Chicago, and Houston) with ~1.67 million residents. Phoenix is one of only
      13 U.S. cities with teams in all four major professional sports leagues (NFL: Cardinals in Glendale;
      NBA: Suns downtown; MLB: Diamondbacks downtown; NHL: Coyotes relocated 2024). Phoenix has a dedicated
      Office of Heat Response and Mitigation — the first such city office in a major U.S. city, established
      under Mayor Kate Gallego.`,
    },
    {
      slug: 'climate-environment',
      name: 'Climate & Environment',
      description: `Phoenix is the hottest large city in the United States, located in the Sonoran Desert.
      In 2024, Phoenix experienced 113 consecutive days with temperatures reaching at least 100°F — shattering
      the previous record of 76 days (set in 1993). Phoenix has one of the largest urban heat island effects in
      the world, with up to a 10–14°F temperature difference between Sky Harbor Airport and surrounding rural
      areas. The city's goal is to cover 25% of the city with shade by 2030. Phoenix established the nation's
      first major-city Office of Heat Response and Mitigation. The city sits in the Salt River Valley within
      Maricopa County. The Valley of the Sun nickname reflects the region's average 299 sunny days per year.
      Questions may address desert adaptation, water conservation policy, and the urban heat island challenge.`,
    },
    {
      slug: 'sports-education',
      name: 'Sports & Education',
      description: `Downtown Phoenix has two major professional sports venues: Talking Stick Resort Arena
      (opened June 6, 1992, home to the NBA Phoenix Suns and WNBA Phoenix Mercury) and Chase Field (opened
      March 31, 1998, home to the MLB Arizona Diamondbacks, capacity 48,519). The Arizona Cardinals (NFL)
      play at State Farm Stadium in Glendale. The Arizona Coyotes (NHL) relocated/folded in 2024. Arizona
      State University (ASU) was founded in 1885 as the Territorial Normal School; its main campus is in
      Tempe (not Phoenix). ASU enrollment is ~160,000, making it one of the largest public universities in
      the U.S. It has been ranked #1 Most Innovative School by U.S. News for 11 consecutive years. The Frank
      Lloyd Wright–designed ASU Gammage auditorium is a notable performing arts venue on the Tempe campus.
      Note: Frame ASU questions carefully — it is a Phoenix-area institution but technically in Tempe.`,
    },
  ],

  topicDistribution: {
    'city-government': 20,
    'founding-history': 18,
    'landmarks-culture': 18,
    'infrastructure-water': 12,
    'economy-innovation': 15,
    'climate-environment': 8,
    'sports-education': 9,
  },

  // DO NOT put the Vice Mayor title in this roster. Phoenix's council elects a
  // Vice Mayor from among its own members and the title turns over roughly
  // every year, while the council SEATS run four years — so a role string like
  // "District 3 Councilmember / Vice Mayor" is stale long before its termEnd.
  // That is exactly how phxaz-011 came to assert, in production, that Debra
  // Stark was Vice Mayor: Ann O'Brien held it through 2025 and Kesha Hodge
  // Washington holds it now. Roster verified 2026-09-28 against the council
  // roll; the Vice Mayor of the day is tracked by phxaz-097 instead, which
  // carries a one-year expires_at.
  officeholders: [
    { name: 'Kate Gallego', role: 'Mayor', termEnd: '2029-04-16T00:00:00Z' },
    { name: 'Ann O\'Brien', role: 'District 1 Councilmember', district: 'District 1', termEnd: '2029-04-16T00:00:00Z' },
    { name: 'Jim Waring', role: 'District 2 Councilmember', district: 'District 2', termEnd: '2027-04-19T00:00:00Z' },
    { name: 'Debra Stark', role: 'District 3 Councilmember', district: 'District 3', termEnd: '2029-04-16T00:00:00Z' },
    { name: 'Laura Pastor', role: 'District 4 Councilmember', district: 'District 4', termEnd: '2027-04-19T00:00:00Z' },
    { name: 'Betty Guardado', role: 'District 5 Councilmember', district: 'District 5', termEnd: '2029-04-16T00:00:00Z' },
    { name: 'Kevin Robinson', role: 'District 6 Councilmember', district: 'District 6', termEnd: '2027-04-19T00:00:00Z' },
    { name: 'Anna Hernandez', role: 'District 7 Councilmember', district: 'District 7', termEnd: '2029-04-16T00:00:00Z' },
    { name: 'Kesha Hodge Washington', role: 'District 8 Councilmember', district: 'District 8', termEnd: '2027-04-19T00:00:00Z' },
  ],

  sourceUrls: [
    'https://en.wikipedia.org/wiki/Phoenix,_Arizona',
    'https://en.wikipedia.org/wiki/History_of_Phoenix,_Arizona',
    'https://en.wikipedia.org/wiki/Heard_Museum',
    'https://en.wikipedia.org/wiki/Desert_Botanical_Garden',
    'https://en.wikipedia.org/wiki/Camelback_Mountain',
    'https://en.wikipedia.org/wiki/Phoenix_Sky_Harbor_International_Airport',
    'https://en.wikipedia.org/wiki/Chase_Field',
    'https://en.wikipedia.org/wiki/Theodore_Roosevelt_Dam',
    'https://en.wikipedia.org/wiki/Great_Papago_Escape',
    'https://en.wikipedia.org/wiki/Salt_River_Project',
  ],
};
