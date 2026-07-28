import type { LocaleConfig } from './bloomington-in.js';

/**
 * Milwaukee, WI locale configuration for civic trivia question generation.
 *
 * CRITICAL ACCURACY NOTES:
 * - Milwaukee uses a STRONG MAYOR–COUNCIL system. The Common Council has 15
 *   members, one elected from each of 15 numbered ALDERMANIC DISTRICTS, to
 *   4-year terms. Members are called ALDERPERSON or ALDER. City elections are in
 *   APRIL of even years and are NONPARTISAN; all 15 seats plus the citywide
 *   offices were on the April 2024 ballot, so terms run to April 2028.
 * - Citywide elected offices besides mayor: CITY ATTORNEY, COMPTROLLER, and
 *   TREASURER. These are ELECTED, not appointed — a common error.
 * - The POLICE CHIEF and FIRE CHIEF are appointed by the FIRE AND POLICE
 *   COMMISSION, not by the mayor. Do not say the mayor appoints them.
 * - CITY vs COUNTY: Milwaukee is the seat of MILWAUKEE COUNTY, which has its own
 *   elected County Executive and County Board — a separate government. The
 *   county, not the city, runs the regional parks system that Daniel Hoan helped
 *   establish, and the Milwaukee County War Memorial. Do not attribute county
 *   functions to the city.
 * - MILWAUKEE PUBLIC SCHOOLS is a separate district with its own elected board.
 * - THREE FOUNDERS, THREE SETTLEMENTS: Solomon Juneau (Juneautown, east of the
 *   Milwaukee River), Byron Kilbourn (Kilbourntown, west), and George H. Walker
 *   (Walker's Point, south). They merged into one city on January 31, 1846, and
 *   Juneau became the first mayor. Do not credit a single founder.
 * - The BRIDGE WAR was in 1845, the year BEFORE consolidation — not after. The
 *   cannon aimed at Kilbourn's house was never fired. Kilbourn's deliberately
 *   misaligned street grid is why bridges over the Milwaukee River still cross
 *   at an angle today; that is the standard "why don't the streets line up"
 *   answer.
 * - "CREAM CITY" refers to the pale yellow BRICK made from local clay, NOT to
 *   dairy. This trips people constantly given Wisconsin's dairy reputation.
 * - "The beer that made Milwaukee famous" was SCHLITZ's slogan (1893) — not
 *   Pabst's and not Miller's.
 * - The GREAT CHICAGO FIRE of 1871 crippled Chicago's brewers and helped
 *   Milwaukee's rise — get the direction of causation right.
 * - Milwaukee elected THREE Socialist mayors: Emil Seidel (1910–12), Daniel Hoan
 *   (1916–40), Frank Zeidler (1948–60). Seidel was the first Socialist mayor of
 *   any major American city. "SEWER SOCIALISM" was coined as an INSULT by Morris
 *   Hillquit at the 1932 Socialist Party convention; the Milwaukee socialists
 *   embraced it. Victor Berger founded the movement and was the first Socialist
 *   elected to the U.S. House. This is HISTORICAL party content and is
 *   permitted — it is not a party label on any living officeholder.
 * - STATE/CITY BOUNDARY (hard rule): the Wisconsin state collection (`wisconsin`)
 *   contains zero Milwaukee content by design, and `madison-wi` references
 *   Milwaukee only as "the largest city." Keep it that way in reverse: NO
 *   Wisconsin state government, NO governor or legislature, NO state capitol,
 *   and nothing about Madison. Wisconsin appears here only as the state
 *   Milwaukee sits in.
 * - Harley-Davidson was founded in 1903 by William S. Harley and three Davidson
 *   brothers — Arthur, Walter and William A. Do not say "two founders."
 * - ALL officeholder questions MUST have expiresAt set to the term end.
 * - Max 1 question per officeholder.
 * - No addresses or phone numbers in answer options (quality rule).
 * - No political party labels for LIVING officeholders. Milwaukee's city
 *   elections are nonpartisan; treat them that way.
 *
 * CURRENT OFFICEHOLDERS (citywide offices and all 15 council seats were filled
 * in April 2024; terms run to April 2028):
 * - Mayor: Cavalier Johnson (first won a 2022 special election)
 * - Common Council President: José G. Pérez, District 12
 * - City Attorney: Evan Goyke
 * - Comptroller: Bill Christianson
 * - Treasurer: Spencer Coggs
 * - Alders: 1 Andrea Pratt, 2 Mark Chambers Jr., 3 Alex Brower, 4 Robert Bauman,
 *   5 Lamont T. Westmoreland, 6 Milele A. Coggs, 7 DiAndre Jackson,
 *   8 JoCasta Zamarripa, 9 Larresa Taylor, 10 Sharlen Moore, 11 Peter Burgelis,
 *   12 José G. Pérez, 13 Scott Spiker, 14 Marina Dimitrijevic,
 *   15 Russell W. Stamper
 * - Police Chief: Jeffrey B. Norman (reappointed July 2, 2025)
 * - MPS Superintendent: Dr. Brenda Cassellius (began March 2025)
 *
 * NOTE: Robert Bauman (District 4, since 2004) is the longest-serving sitting
 * alder; Alex Brower (District 3) is the newest, seated April 2025.
 * Spencer Coggs (Treasurer) and Milele A. Coggs (District 6) are DIFFERENT
 * people — never use one as a distractor for the other.
 *
 * DELIBERATELY OMITTED: the fire chief. Aaron Lipski's term was up for
 * reappointment by the Fire and Police Commission in spring 2026 and the
 * outcome was unconfirmed at the time of writing. Add once settled.
 */
export const milwaukeeWiConfig: LocaleConfig = {
  locale: 'milwaukee-wi',
  name: 'Milwaukee, WI',
  externalIdPrefix: 'milwi',
  collectionSlug: 'milwaukee-wi',
  targetQuestions: 130,
  batchSize: 25,
  overshootFactor: 1.4,

  topicCategories: [
    {
      slug: 'milwi-city-government',
      name: 'City Government',
      description:
        'Milwaukee runs a strong mayor–council government. The Common Council has 15 alderpersons, one per numbered aldermanic district, elected to 4-year nonpartisan terms in April of even years; all 15 seats and the citywide offices were last filled in April 2024. Besides the mayor, voters elect the city attorney, the comptroller, and the treasurer — those are elective offices, not mayoral appointments. The Fire and Police Commission, not the mayor, appoints the police and fire chiefs. The council elects its own president. Milwaukee is the seat of Milwaukee County, a separate government with its own elected county executive and county board; the county runs the regional parks system. Do NOT write about Wisconsin state government or Madison — separate collections own those.',
    },
    {
      slug: 'milwi-founding-history',
      name: 'Founding & the Bridge War',
      description:
        'Three rival settlements became Milwaukee. Solomon Juneau, a fur trader who arrived in 1818, developed Juneautown east of the Milwaukee River. Byron Kilbourn laid out Kilbourntown to the west in 1834 and deliberately platted his streets so they would not meet Juneau\'s, even printing maps showing the east side as blank. George H. Walker settled Walker\'s Point to the south, building a log house in 1834. Hostility peaked in the Bridge War of May 1845, when a schooner damaged the Spring Street bridge and West Warders tore down the west half of the Chestnut Street bridge; East Warders aimed an old cannon at Kilbourn\'s house but never fired it after learning his daughter had died. Trustees agreed a bridge plan by December 1845 and the three towns consolidated as the City of Milwaukee on January 31, 1846, with Juneau elected first mayor. The misaligned grids are why bridges over the Milwaukee River still cross at an angle. Cover German immigration in three waves between 1845 and 1893 — 34% of the city was of German background by 1900, earning it the name "German Athens of America" — plus the large Polish community and Milwaukee\'s standing alongside New York for the highest share of foreign-born residents by 1910.',
    },
    {
      slug: 'milwi-brewing-industry',
      name: 'Brewing & Industry',
      description:
        'Milwaukee\'s big four breweries: Pabst, founded 1844 by Jacob Best and his sons and the city\'s largest through the 19th century; Joseph Schlitz, begun by August Krug in 1849 and taken over by Schlitz after Krug died in 1856; Valentin Blatz, 1851; and Miller, founded 1855 when Frederick J. Miller bought the Plank Road Brewery from Lorenz Best. "The beer that made Milwaukee famous" was Schlitz\'s 1893 slogan. The Milwaukee River supplied water and ice for lagering, German immigrants brought the brewing craft, and the Great Chicago Fire of 1871 knocked out Chicago\'s brewers and opened the national market. Blatz closed in Milwaukee in 1959, Schlitz\'s plant in 1982, and Pabst left in 1996; Miller continues under Molson Coors at around 10 million barrels a year. Harley-Davidson was founded in 1903 by William S. Harley with Arthur, Walter and William A. Davidson, prototyped in a 10-by-15-foot backyard shed, incorporated in September 1907, sold over 20,000 motorcycles to the military in World War I and about 90,000 in World War II, and still has its headquarters on Juneau Avenue; the Harley-Davidson Museum opened in 2008 in the Menomonee Valley. Fortune 500 employers today include Northwestern Mutual, Fiserv, ManpowerGroup, Rockwell Automation and WEC Energy Group.',
    },
    {
      slug: 'milwi-socialist-era',
      name: 'The Sewer Socialist Era',
      description:
        'Milwaukee is the only major American city to have elected Socialist mayors repeatedly, and this is the collection\'s most distinctive civic history. Emil Seidel won in 1910 as the first Socialist mayor of any major U.S. city and served to 1912, later running for vice president in 1912. Daniel Hoan governed from 1916 to 1940, one of the longest mayoral tenures in American history, and oversaw creation of the Milwaukee County parks system. Frank Zeidler served three terms from 1948 to 1960 and was the last of them. Victor Berger, an Austrian-born schoolteacher, founded the movement and in 1910 became the first Socialist elected to the U.S. House of Representatives; his wife Meta Berger won school lunches and better teacher pay. The label "sewer socialism" was coined as a jibe by Morris Hillquit at the 1932 Socialist Party convention, mocking Milwaukee\'s socialists for boasting about their sewers; they embraced it. Their programme was practical rather than revolutionary: honest government, public sanitation, municipal utilities, parks and public health. The movement ran roughly 1892 to 1960. This is historical party content and may name the Socialist Party directly.',
    },
    {
      slug: 'milwi-lakefront-culture',
      name: 'Lakefront, Architecture & Culture',
      description:
        'The Milwaukee Art Museum sits on the Lake Michigan lakefront. Its Quadracci Pavilion, by Spanish architect Santiago Calatrava, was completed in 2001 and carries the Burke Brise Soleil, a movable sunscreen with a 217-foot wingspan that opens by day and folds at night or when wind sensors read over 23 mph for three seconds. Windhover Hall, the glass-roofed reception space, rises 90 feet. The adjoining Milwaukee County War Memorial, by Eero Saarinen, opened in 1957 and housed the museum\'s first collections; note it is a COUNTY building. The museum holds over 34,000 works. Summerfest began in 1968, championed by Mayor Henry W. Maier after he saw Munich\'s Oktoberfest; it runs on the 75-acre Henry Maier Festival Park on the lakefront, was certified by Guinness World Records in 1999 as the world\'s largest music festival, peaked above a million visitors across 12 days in 2001, and moved to a three-weekend format in 2021. Its main stage, the American Family Insurance Amphitheater, seats 23,000 after a $51.3 million renovation. Also cover the Historic Third Ward, the RiverWalk, the Mitchell Park Domes, the Milwaukee Public Museum, the Hoan Bridge, the Marquette Interchange, and The Hop streetcar, which began service in 2018. Cream City brick — pale yellow brick from local clay — gave the city its nickname and is not a dairy reference.',
    },
    {
      slug: 'milwi-civil-rights',
      name: 'Civil Rights & Neighborhoods',
      description:
        'Father James Groppi advised the Milwaukee NAACP Youth Council from 1965 to 1968 and led sustained open-housing demonstrations in 1967 and 1968, with marchers repeatedly crossing the 16th Street Viaduct over the Menomonee River Valley. The half-mile-wide valley was treated as the symbolic dividing line between the Black north side and the white south side, which is why the crossing mattered so much. The campaign helped force a city open-housing ordinance in 1968, shortly before the federal Fair Housing Act; the viaduct was later renamed in Groppi\'s honour. Cover the marches, the Youth Council and its Commandos, school segregation protests, the Menomonee Valley as a physical and social divide, and Milwaukee\'s neighbourhood and demographic history, including its Polish community — the fifth largest in the United States — and Bronzeville. Treat this history factually and precisely; do not soften or exaggerate it.',
    },
    {
      slug: 'milwi-services-community',
      name: 'Services, Schools & the City Today',
      description:
        'Milwaukee counted 577,222 residents in the 2020 census, making it the largest city in Wisconsin and 31st largest in the country, in a metro area of about 1.57 million; the city peaked at 741,324 in 1960 and has been declining since. It covers about 97 square miles at the confluence of three rivers — the Milwaukee, the Menomonee and the Kinnickinnic — with glacier-cut bluffs along Lake Michigan. Milwaukee Public Schools is a separate district led by a superintendent hired by an elected school board. Higher education includes the University of Wisconsin–Milwaukee, Marquette University and the Milwaukee School of Engineering. The Hop streetcar opened in 2018 and Milwaukee Mitchell International Airport serves the region. The Milwaukee Brewers play at American Family Field and the Bucks at Fiserv Forum, which opened in 2018. Cover public services, schools, transit, utilities, and the institutions that run them, always separating city functions from those of Milwaukee County or the school district.',
    },
  ],

  // Sums to 100
  topicDistribution: {
    'milwi-city-government': 20,
    'milwi-founding-history': 13,
    'milwi-brewing-industry': 14,
    'milwi-socialist-era': 12,
    'milwi-lakefront-culture': 16,
    'milwi-civil-rights': 12,
    'milwi-services-community': 13,
  },

  officeholders: [
    { name: 'Cavalier Johnson', role: 'Mayor', termEnd: '2028-04-18T00:00:00Z' },
    {
      name: 'José G. Pérez',
      role: 'Common Council President',
      district: 'District 12',
      termEnd: '2028-04-18T00:00:00Z',
    },
    { name: 'Evan Goyke', role: 'City Attorney', termEnd: '2028-04-18T00:00:00Z' },
    { name: 'Bill Christianson', role: 'Comptroller', termEnd: '2028-04-18T00:00:00Z' },
    { name: 'Spencer Coggs', role: 'Treasurer', termEnd: '2028-04-18T00:00:00Z' },
    { name: 'Robert Bauman', role: 'Alderperson', district: 'District 4', termEnd: '2028-04-18T00:00:00Z' },
    { name: 'Milele A. Coggs', role: 'Alderperson', district: 'District 6', termEnd: '2028-04-18T00:00:00Z' },
    { name: 'JoCasta Zamarripa', role: 'Alderperson', district: 'District 8', termEnd: '2028-04-18T00:00:00Z' },
    { name: 'Scott Spiker', role: 'Alderperson', district: 'District 13', termEnd: '2028-04-18T00:00:00Z' },
    { name: 'Marina Dimitrijevic', role: 'Alderperson', district: 'District 14', termEnd: '2028-04-18T00:00:00Z' },
    { name: 'Russell W. Stamper', role: 'Alderperson', district: 'District 15', termEnd: '2028-04-18T00:00:00Z' },
    { name: 'Alex Brower', role: 'Alderperson', district: 'District 3', termEnd: '2028-04-18T00:00:00Z' },
    { name: 'Jeffrey B. Norman', role: 'Chief of Police', termEnd: '2029-07-02T00:00:00Z' },
    {
      name: 'Brenda Cassellius',
      role: 'Superintendent, Milwaukee Public Schools',
      termEnd: '2028-04-18T00:00:00Z',
    },
  ],

  sourceUrls: [
    'https://en.wikipedia.org/wiki/Milwaukee',
    'https://en.wikipedia.org/wiki/Milwaukee_Bridge_War',
    'https://en.wikipedia.org/wiki/Milwaukee_Common_Council',
    'https://en.wikipedia.org/wiki/Sewer_socialism',
    'https://en.wikipedia.org/wiki/Milwaukee_Art_Museum',
    'https://en.wikipedia.org/wiki/Beer_in_Milwaukee',
    'https://en.wikipedia.org/wiki/Harley-Davidson',
    'https://en.wikipedia.org/wiki/Summerfest',
    'https://en.wikipedia.org/wiki/James_Groppi',
    'https://en.wikipedia.org/wiki/Milwaukee_Public_Schools',
  ],
};
