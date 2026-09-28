import type { LocaleConfig } from './bloomington-in.js';

/**
 * St. Louis, MO locale configuration for civic trivia question generation.
 *
 * CRITICAL ACCURACY NOTES:
 * - St. Louis is an INDEPENDENT CITY — it does not belong to any county.
 *   It separated from St. Louis County in 1876-1877 (the "Great Divorce").
 *   Never attribute county services or St. Louis County government to the city.
 * - The city uses a strong mayor-council system. The mayor is chief executive.
 *   The Board of Aldermen has 14 members from 14 wards, plus a Board President
 *   elected citywide who casts the 15th vote on ties.
 * - Cara Spencer became the 48th Mayor on April 15, 2025 (defeated Tishaura Jones).
 * - The Gateway Arch is in Gateway Arch National Park — a federal monument,
 *   not a city facility. Do not say the city "operates" the Arch.
 * - Forest Park (1,326 acres) is city-owned; ~500 acres larger than Central Park.
 *   The Zoo, Art Museum, Science Center, and History Museum inside Forest Park are
 *   largely funded by the Zoo-Museum District (ZMD) property tax.
 * - Do NOT write questions about Cardinals/Blues game results, standings, or player stats.
 * - Cap sports questions at 6 total across all teams.
 * - ALL officeholder questions MUST have expiresAt set.
 * - No addresses or phone numbers in answer options (quality rule).
 *
 * CURRENT OFFICEHOLDERS (verify before activating):
 * - Mayor: Cara Spencer (48th Mayor, sworn April 15, 2025; ~term ends 2029-04-15)
 * - Board of Aldermen President: Megan Green (elected July 1, 2025 special election)
 * - Comptroller: Donna Baringer (elected April 8, 2025)
 */
export const stLouisMoConfig: LocaleConfig = {
  locale: 'st-louis-mo',
  name: 'St. Louis, MO',
  externalIdPrefix: 'stlmo',
  collectionSlug: 'st-louis-mo',
  targetQuestions: 130,
  batchSize: 25,
  overshootFactor: 1.4,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description:
        'St. Louis uses a strong mayor-council system. The mayor is chief executive, elected citywide to a 4-year term. The Board of Aldermen has 14 members from 14 wards, plus a Board President elected citywide who casts the 15th vote on ties. St. Louis is an independent city — it left St. Louis County in 1876-1877 ("the Great Divorce"). The city performs both city AND county functions. Cara Spencer (48th Mayor) was sworn in April 15, 2025. Megan Green is Board President (elected July 2025 special election). Donna Baringer is Comptroller (elected April 2025). The city officially recognizes 79 neighborhoods. Write questions about: government structure, independent city status, the Great Divorce (1876-1877), ward system, aldermanic roles, Board President role, current officeholders.',
    },
    {
      slug: 'founding-history',
      name: 'Founding & History',
      description:
        'St. Louis was founded on February 15, 1764 by Pierre Laclède, who sent 14-year-old Auguste Chouteau with about 30 men to establish the trading post. Named after King Louis IX of France. The 1904 World\'s Fair (Louisiana Purchase Exposition) was held in Forest Park from April 30 to December 1, 1904; commemorated the centennial of the Louisiana Purchase; attended by nearly 19.7 million people; cost $15 million; covered 1,200 acres with 1,500 buildings; President Theodore Roosevelt officially opened it at 1:04 p.m. on April 30, 1904. Only 2 buildings were built to outlast the fair: the Flight Cage (now St. Louis Zoo) and the Palace of Fine Arts (now Saint Louis Art Museum). Products associated with the fair: hot dogs, cotton candy, waffle ice cream cone, iced tea, peanut butter. Write questions about: founding date 1764, Laclède, Chouteau (14 years old), naming after Louis IX, 1904 fair attendance/cost/dates, Roosevelt opening, Zoo/Art Museum origins.',
    },
    {
      slug: 'gateway-arch',
      name: 'Gateway Arch & Westward Expansion',
      description:
        'The Gateway Arch stands 630 feet tall (192 meters) — world\'s tallest arch and Missouri\'s tallest accessible structure. Designed by Finnish-American architect Eero Saarinen (designed 1947). Construction: February 12, 1963 to October 28, 1965. Cost $13 million. Public opening June 10, 1967. The arch is a weighted catenary arch clad in stainless steel. It is in Gateway Arch National Park (redesignated national park in 2018; previously Jefferson National Expansion Memorial since 1935). Commemorates westward expansion and St. Louis as "Gateway to the West." The Arch is 630 feet wide at its base as well. Write questions about: height (630 ft), architect Eero Saarinen, construction dates (1963-1965), public opening (1967), shape (catenary), national park redesignation (2018), previous name (Jefferson National Expansion Memorial), stainless steel cladding.',
    },
    {
      slug: 'landmarks-culture',
      name: 'Landmarks & Culture',
      description:
        'Forest Park (1,326 acres; opened 1876): St. Louis Zoo (free admission, ZMD funded), St. Louis Art Museum (free), St. Louis Science Center (free), Missouri History Museum, The Muny amphitheater. Forest Park is ~500 acres larger than New York\'s Central Park. Busch Stadium: opened April 10, 2006; capacity 44,383; home of Cardinals. City Museum: opened October 1997 in former International Shoe building; rooftop Ferris wheel installed 2006; Enchanted Caves opened 2003. Anheuser-Busch Brewery: Adolphus Busch joined 1869; first American brewer to use pasteurization and refrigerated railroad cars (1876); National Historic Landmark 1966; 142 acres, 189 buildings. St. Louis Cardinals: founded 1882 by Chris von der Ahe; 11 World Series titles. St. Louis Blues: founded 1967; first Stanley Cup 2019. St. Louis City SC: joined MLS 2023; first female majority-owned MLS team. Washington University: founded 1853; ranked #20 in National Universities (2026). Cap sports questions at 6 total.',
    },
    {
      slug: 'community-economy',
      name: 'Community & Economy',
      description:
        'City population 301,578 at the 2020 census; metro area over 2 million across two states. Do NOT write questions pinned to a single-year population estimate — stlmo-020 and stlmo-091 both rotted that way. City has 79 officially recognized neighborhoods. City flag: designed by Theodore Sizer (Yale professor), adopted 1964; red background with blue/white wavy lines representing the confluence of Missouri and Mississippi Rivers, plus a gold disk with blue fleur-de-lis (French heritage/Louisiana Purchase). Major employers: Anheuser-Busch, Boeing, Nestlé Purina, Edward Jones. 22 Fortune 1000/Forbes Global 2000 companies headquartered here. Healthcare is the largest employment sector (199,463 workers). Third most economically diverse U.S. metro area. Powell Hall (former movie palace) = home of St. Louis Symphony. Fox Theatre = premier live performance venue. Write questions about: flag design/symbolism/designer, major employers, economic diversity ranking, Symphony/arts venues, Forest Park free-admission institutions.',
    },
    {
      slug: 'beyond-city-hall',
      name: 'Beyond City Hall',
      description:
        'The governments that serve St. Louis but are not the city. St. Louis Public Schools is an independent district with its own elected Board of Education. Federal representation: the City of St. Louis sits entirely inside Missouri\'s 1st congressional district; Missouri elects two U.S. senators like every state. Added 2026-09-28 — these questions were previously filed under City Government, which is the label the player sees above the question.',
    },
    {
      slug: 'elections-voting',
      name: 'Elections & Voting',
      description:
        'How St. Louis actually votes. Proposition D (November 3, 2020, 68% in favour) replaced partisan primaries with a nonpartisan blanket primary using approval voting — a voter may pick as many candidates as they approve of, unordered, and the top two advance to the general. A 2022 Proposition R created an independent ward-boundary commission and put the election method beyond the board\'s reach, so only a public vote can change it. City elections fall in odd-numbered years.',
    },
  ],

  topicDistribution: {
    'city-government': 20,
    'founding-history': 18,
    'gateway-arch': 15,
    'landmarks-culture': 22,
    'community-economy': 12,
    'beyond-city-hall': 7,
    'elections-voting': 6,
  },

  // NOTE (2026-09-28): the gate only checks the people listed here, and prints
  // nothing for offices that are absent — silence is not coverage. All eight
  // were verified on 2026-09-28. The St. Louis SHERIFF is deliberately absent:
  // the elected sheriff was removed from office in early 2026 and the interim
  // holder is in active litigation, so there is no stable fact to ask for.
  officeholders: [
    { name: 'Cara Spencer', role: 'Mayor (48th)', termEnd: '2029-04-15T00:00:00Z' },
    { name: 'Megan Green', role: 'Board of Aldermen President', termEnd: '2029-04-15T00:00:00Z' },
    { name: 'Donna Baringer', role: 'Comptroller', termEnd: '2029-04-15T00:00:00Z' },
    { name: 'Gabe Gore', role: 'Circuit Attorney', termEnd: '2029-01-01T00:00:00Z' },
    { name: 'Adam Layne', role: 'Treasurer', termEnd: '2029-01-01T00:00:00Z' },
    { name: 'Robert Tracy', role: 'Police Commissioner', termEnd: '2028-01-01T00:00:00Z' },
    { name: 'Wesley Bell', role: 'U.S. Representative, MO-1', termEnd: '2027-01-03T00:00:00Z' },
    { name: 'Myra Berry', role: 'Superintendent, St. Louis Public Schools', termEnd: '2029-06-30T00:00:00Z' },
  ],

  sourceUrls: [
    'https://en.wikipedia.org/wiki/St._Louis',
    'https://en.wikipedia.org/wiki/Gateway_Arch',
    'https://en.wikipedia.org/wiki/Forest_Park_(St._Louis)',
    'https://en.wikipedia.org/wiki/Louisiana_Purchase_Exposition',
    'https://en.wikipedia.org/wiki/St._Louis_Cardinals',
    'https://en.wikipedia.org/wiki/St._Louis_Blues',
    'https://en.wikipedia.org/wiki/Busch_Stadium',
    'https://en.wikipedia.org/wiki/Flag_of_St._Louis',
  ],
};
