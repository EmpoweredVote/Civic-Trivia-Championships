import type { LocaleConfig } from './bloomington-in.js';

/**
 * Madison, WI locale configuration for civic trivia question generation.
 *
 * CRITICAL ACCURACY NOTES:
 * - Madison is a MAYOR–COUNCIL city with a 20-member Common Council. Members are
 *   called ALDERS (not "council members", not "aldermen") and their districts are
 *   ALDERMANIC DISTRICTS numbered 1–20.
 * - Alders serve 2-year STAGGERED terms: even-numbered districts were elected in
 *   April 2026 (terms run to April 2028); odd-numbered districts run to April 2027.
 *   The staggering is recent — do not write questions implying all 20 seats turn
 *   over at once.
 * - The Mayor serves a 4-year term. Madison municipal elections are SPRING
 *   (April) elections and are officially NONPARTISAN.
 * - CITY vs COUNTY: Madison is the seat of DANE COUNTY. Do not attribute county
 *   functions to the city. Henry Vilas Zoo and Dane County Regional Airport are
 *   COUNTY-owned, not city-owned. The Dane County Farmers' Market is run by a
 *   private association, not the city. The Common Council meets in the CITY-COUNTY
 *   BUILDING, a shared city/county facility.
 * - STATE-COLLECTION BOUNDARY (hard rule): the Wisconsin State Capitol, the
 *   Wisconsin Legislature, statewide officeholders, and the University of
 *   Wisconsin–Madison belong to the WISCONSIN state collection, NOT here. Do not
 *   write Madison questions about the Capitol building, the dome, the "Wisconsin"
 *   statue, Camp Randall, Bascom Hill, the Memorial Union, or the Wisconsin Idea.
 *   Capitol Square and State Street may appear only as CITY places (the street
 *   itself, the market that rings the Square, the pedestrian mall ordinance) —
 *   never as questions about the building or the university at the other end.
 * - Frank Lloyd Wright's Madison work IS city content: Monona Terrace (city-owned
 *   convention center) and the First Unitarian Society Meeting House.
 * - Monona Terrace sits on Lake Monona; Olbrich is on Lake Monona's east side;
 *   Lake Mendota is the largest and northernmost of the four lakes.
 * - The four lakes are Mendota, Monona, Waubesa, and Kegonsa. Only Mendota,
 *   Monona, and Wingra are within the city proper — Waubesa and Kegonsa are
 *   downstream. Do not claim all four are inside Madison.
 * - Epic Systems is in VERONA, not Madison. Do not call it a Madison employer
 *   without that qualifier.
 * - The First Unitarian Society Meeting House is in SHOREWOOD HILLS, a separate
 *   village surrounded by Madison. Say "Madison area" if it comes up.
 * - ALL officeholder questions MUST have expiresAt set to the term end.
 * - Max 1 question per officeholder.
 * - No addresses or phone numbers in answer options (quality rule).
 * - No political party labels anywhere — no Democrat/Republican/Independent/
 *   Progressive Dane in question text, options, or explanations. Madison's local
 *   elections are nonpartisan; treat them that way.
 *
 * CURRENT OFFICEHOLDERS:
 * - Mayor: Satya Rhodes-Conway (term ends 2027-04-20)
 * - Common Council President: Sabrina Madison, District 17 (term ends 2027-04-20)
 *   (the city's /council page writes it "Sabrina V. Madison"; the city roster and
 *   the April 2026 leadership announcement both use "Sabrina Madison", which is
 *   the form used in content here)
 * - Common Council Vice President: Carmella Glenn, District 18 (term ends 2028-04-18)
 * - MMSD Superintendent: Dr. Joe Gothard (appointed, no fixed term — treated as
 *   expiring on the next board cycle, 2027-04-20)
 */
export const madisonWiConfig: LocaleConfig = {
  locale: 'madison-wi',
  name: 'Madison, WI',
  externalIdPrefix: 'madwi',
  collectionSlug: 'madison-wi',
  targetQuestions: 130,
  batchSize: 25,
  overshootFactor: 1.4,

  topicCategories: [
    {
      slug: 'madwi-city-government',
      name: 'City Government',
      description:
        'Madison city government: the mayor–council form, the 20-member Common Council whose members are called alders, the 20 numbered aldermanic districts, 2-year staggered alder terms (even districts elected in even years, odd districts in odd years), the mayor\'s 4-year term, nonpartisan spring elections held in April, the Council President and Vice President elected by the alders themselves, Common Council meetings in the City-County Building, the City Clerk and city departments, and city boards and commissions. Madison is the seat of Dane County — be explicit that county government is separate. Do NOT write about the Wisconsin State Capitol, the Legislature, or statewide officials; those belong to the Wisconsin state collection.',
    },
    {
      slug: 'madwi-founding-history',
      name: 'Founding & Civic History',
      description:
        'James Duane Doty, a former federal judge appointed in 1823, bought over 1,000 acres on the isthmus in 1836 and platted a city he named for President James Madison, who died June 28, 1836. Doty named the streets for signers of the U.S. Constitution and handed out lots to territorial legislators meeting at Belmont to win the capital designation in 1836 — by the final vote roughly half the legislators owned Madison land. Madison incorporated as a village in 1846 and as a city in 1856. The Ho-Chunk called the region Teejop, "land of the four lakes." The first public school in Madison held classes in 1838. Cover civic milestones, the growth of the isthmus city, and Madison\'s role as a center of civic protest. Do NOT cover Wisconsin statehood itself — that is state content.',
    },
    {
      slug: 'madwi-lakes-parks',
      name: 'Lakes, Parks & Environment',
      description:
        'Madison sits on an isthmus between Lake Mendota and Lake Monona, with Lake Wingra to the southwest. Lake Mendota is the largest and northernmost at about 9,740 acres and 83 feet at its deepest, and has been called the most studied lake in the world. The Yahara River connects Mendota to Monona, with the Tenney Park Lock and Dam regulating flow. The Ho-Chunk name for Mendota is Wąąkšikhomįkra, "Where the Person Rests"; the name Mendota was adopted in 1849. Olbrich Botanical Gardens, founded 1952 and named for Michael Olbrich, is jointly run by the city Parks Department and the nonprofit Olbrich Botanical Society: 16 acres of outdoor gardens (free), the 10,000-square-foot Bolz Conservatory glass pyramid (small fee), and a Thai Pavilion opened in 2002, one of only two such salas in the United States. Madison has a high concentration of parks per capita and is a recognized bicycle-friendly community. Henry Vilas Zoo is DANE COUNTY-owned — 28 acres, opened 1911 on land the Vilas family gave in 1904 in memory of their son Henry, on the condition it stay free forever; it is one of about ten remaining free zoos in North America and draws roughly 750,000 visitors a year.',
    },
    {
      slug: 'madwi-landmarks-culture',
      name: 'Landmarks & Culture',
      description:
        'Monona Terrace: Frank Lloyd Wright first proposed it in 1938 and it was rejected by one vote; he kept pushing until his death in 1959; voters approved it by referendum in 1992, construction began January 25, 1995, and it opened July 18, 1997, nearly 60 years after the original design. Anthony Puttnam of Taliesin Associated Architects executed the interior. It is 250,000 square feet on the Lake Monona shore with a rooftop garden. The Overture Center for the Arts at 201 State Street was designed by César Pelli, funded by a gift from Jerome Frautschi and Pleasant Rowland totaling $205 million, and opened September 19, 2004, replacing the Madison Civic Center; it has five venues seating 252 to 2,255 and houses the Madison Museum of Contemporary Art. State Street runs 0.78 miles from the Capitol\'s southwest corner to Library Mall and became a restricted pedestrian-oriented street in 1974, open only to buses, bicycles, emergency vehicles, deliveries, and pedestrians. The Dane County Farmers\' Market, founded in 1972 under Mayor Bill Dyke, rings Capitol Square on Saturday mornings and is America\'s largest producers-only farmers\' market. Freakfest is the city-sanctioned State Street Halloween event. The First Unitarian Society Meeting House, designed by Frank Lloyd Wright and completed in 1951 with its prow-like copper roof, became a National Historic Landmark on August 18, 2004; Wright was a member and the son of two founders. Madison has nine National Historic Landmarks. Do NOT write about the Capitol building or the university campus.',
    },
    {
      slug: 'madwi-services-transit',
      name: 'City Services & Transit',
      description:
        'Metro Transit is owned and operated by the City of Madison. Bus service began in 1910; the city bought the Madison Bus Company on May 1, 1970. A June 11, 2023 network redesign cut the number of routes, raised frequency, and moved most routes back to letter designations. Madison\'s first bus rapid transit line, Rapid Route A, opened September 22, 2024 as an east-west corridor built for $195 million, using battery-electric articulated buses in center-running lanes with service every 5 to 15 minutes on weekdays; a north-south line is planned to replace Route B by 2028. Annual ridership was about 9.2 million in 2024. Madison Public Library was established by ordinance in November 1874 and opened in 1875; it has nine locations — Central plus eight neighborhood branches — and is part of the South Central Library System. Madison Metropolitan School District is a separate unit of government from the city: about 25,000 students across 54 schools, four comprehensive high schools (Madison East, Madison West, La Follette, and Vel Phillips Memorial — renamed from James Madison Memorial in 2021), governed by a seven-member elected school board serving staggered three-year terms chosen in April elections. Dane County Regional Airport (MSN) is county-owned, about seven miles northeast of downtown, originally Truax Field, and hosts the Wisconsin Air National Guard 115th Fighter Wing.',
    },
    {
      slug: 'madwi-economy-community',
      name: 'Economy & Community',
      description:
        'Madison\'s 2020 census population was 269,840, the second-largest city in Wisconsin, with a 2024 estimate around 285,300, and it was the fastest-growing city in Wisconsin as of 2024. The city is roughly 71% White, 9.5% Asian, 7.4% Black, and 8.7% Hispanic or Latino. Major employers include the University of Wisconsin–Madison, UW Health, state government, American Family Insurance, Exact Sciences, Trek Bicycle, and Sub-Zero; Epic Systems is a major regional employer but is located in Verona, not Madison. The city has more than 120 recognized neighborhood associations, including Capitol Square, the Marquette neighborhood, and Dudgeon-Monroe around Monroe Street. Madison is nicknamed the City of Four Lakes and Mad City. The Freedom From Religion Foundation is headquartered in Madison. Cover local economy, neighborhoods, demographics, and community institutions — not the university itself as an academic institution, which is state content.',
    },
  ],

  // Sums to 100
  topicDistribution: {
    'madwi-city-government': 22,
    'madwi-founding-history': 16,
    'madwi-lakes-parks': 16,
    'madwi-landmarks-culture': 20,
    'madwi-services-transit': 15,
    'madwi-economy-community': 11,
  },

  officeholders: [
    {
      name: 'Satya Rhodes-Conway',
      role: 'Mayor',
      termEnd: '2027-04-20T00:00:00Z',
    },
    {
      name: 'Sabrina Madison',
      role: 'Common Council President',
      district: 'District 17',
      termEnd: '2027-04-20T00:00:00Z',
    },
    {
      name: 'Carmella Glenn',
      role: 'Common Council Vice President',
      district: 'District 18',
      termEnd: '2028-04-18T00:00:00Z',
    },
    {
      name: 'Joe Gothard',
      role: 'Superintendent, Madison Metropolitan School District',
      termEnd: '2027-04-20T00:00:00Z',
    },
  ],

  sourceUrls: [
    'https://en.wikipedia.org/wiki/Madison,_Wisconsin',
    'https://en.wikipedia.org/wiki/James_Duane_Doty',
    'https://en.wikipedia.org/wiki/Monona_Terrace',
    'https://en.wikipedia.org/wiki/Overture_Center_for_the_Arts',
    'https://en.wikipedia.org/wiki/Olbrich_Botanical_Gardens',
    'https://en.wikipedia.org/wiki/Henry_Vilas_Zoo',
    'https://en.wikipedia.org/wiki/Dane_County_Farmers%27_Market',
    'https://en.wikipedia.org/wiki/Metro_Transit_(Madison)',
    'https://en.wikipedia.org/wiki/Madison_Metropolitan_School_District',
    'https://en.wikipedia.org/wiki/Lake_Mendota',
    'https://en.wikipedia.org/wiki/State_Street_(Madison)',
    'https://en.wikipedia.org/wiki/First_Unitarian_Society_Meeting_House',
    'https://en.wikipedia.org/wiki/Dane_County_Regional_Airport',
    'https://en.wikipedia.org/wiki/Madison_Public_Library_(Madison,_Wisconsin)',
    'https://www.cityofmadison.com/council',
  ],
};
