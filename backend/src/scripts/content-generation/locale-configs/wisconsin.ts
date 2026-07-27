import type { LocaleConfig } from './bloomington-in.js';

/**
 * Wisconsin state locale configuration for civic trivia question generation.
 *
 * CRITICAL ACCURACY NOTES:
 * - The legislature is the WISCONSIN LEGISLATURE, made up of a 33-member SENATE
 *   and a 99-member ASSEMBLY (not "House of Representatives"). Senators serve
 *   4-year staggered terms; Assembly members serve 2-year terms. Every Senate
 *   district contains exactly three Assembly districts.
 * - "Forward" is the state MOTTO (1851). "America's Dairyland" is the state
 *   SLOGAN (1940) and "Badger State" is the NICKNAME — do not call either one the
 *   motto. This is the single most common error on Wisconsin content.
 * - The Badger State nickname comes from 1820s–30s LEAD MINERS in the southwest
 *   who burrowed shelters into hillsides and "lived like badgers" — NOT from the
 *   animal being native or from the university mascot. The badger became the
 *   official state animal only in 1957.
 * - Wisconsin's governor has the strongest partial veto in the nation, but the
 *   scope has narrowed over time: the "Vanna White" veto (striking letters to
 *   form new words) was banned by constitutional amendment in 1990, and the
 *   "Frankenstein" veto (stitching together non-adjacent sentences) was banned by
 *   amendment in 2008. Do not describe either as still available.
 * - The partial veto applies to APPROPRIATION bills only, not all legislation.
 * - Wisconsin's constitution was ratified March 13, 1848; a FIRST draft was
 *   rejected by voters in 1846 as too radical. Statehood followed May 29, 1848,
 *   as the 30th state.
 * - CITY-COLLECTION BOUNDARY (hard rule): questions must be strict state scale.
 *   Test: "Could a future Milwaukee, Green Bay, or Madison collection own this?"
 *   If yes, cut it. Do NOT write about Madison's mayor, Common Council, lakes,
 *   parks, Monona Terrace, State Street, or Metro Transit — those belong to the
 *   Madison, WI collection. Do NOT write about the Green Bay Packers, Milwaukee's
 *   city government, or any city's local landmarks. Madison appears here ONLY as
 *   the seat of state institutions ("Wisconsin's capital is Madison" is fine).
 * - The Wisconsin State Capitol and the University of Wisconsin–Madison as the
 *   state's flagship land-grant university ARE state content and belong here.
 * - Ripon's Little White Schoolhouse claim to the Republican Party's founding is
 *   CONTESTED — Jackson, Michigan and Crawfordsville, Iowa make competing claims.
 *   Always phrase these questions as a claim, never as settled fact.
 * - Wisconsin is a STATE, not a commonwealth. Do not use "commonwealth".
 * - Wisconsin has 72 counties.
 * - ALL officeholder questions MUST have expiresAt set to the term end.
 * - Max 1 question per officeholder.
 * - No addresses or phone numbers in answer options (quality rule).
 * - No political party labels anywhere — no Democrat/Republican/Independent in
 *   question text, options, or explanations. The Republican Party's 1854 founding
 *   at Ripon is a HISTORICAL event and may be named as such; do not label any
 *   living officeholder's affiliation.
 *
 * CURRENT OFFICEHOLDERS (all five constitutional officers' terms expire
 * January 4, 2027 — the 2026 general election fills them):
 * - Governor: Tony Evers (term ends 2027-01-04)
 * - Lieutenant Governor: Sara Rodriguez (term ends 2027-01-04)
 * - Attorney General: Josh Kaul (term ends 2027-01-04)
 * - Secretary of State: Sarah Godlewski (term ends 2027-01-04)
 * - State Treasurer: John S. Leiber (term ends 2027-01-04)
 * - Supreme Court Chief Justice: Jill J. Karofsky (chief justice term ends
 *   2027-04-30; her seat on the court runs to July 2030)
 * - Senate President: Mary Felzkowski (session ends 2027-01-04)
 * - Assembly Speaker: Robin Vos, Speaker since January 2013 (session ends
 *   2027-01-04)
 *
 * STATE-SCALE RULE: zero overlap with current or future city collections.
 */
export const wisconsinConfig: LocaleConfig = {
  locale: 'wisconsin',
  name: 'Wisconsin',
  externalIdPrefix: 'wisco',
  collectionSlug: 'wisconsin',
  targetQuestions: 130,
  batchSize: 25,
  overshootFactor: 1.4,

  topicCategories: [
    {
      slug: 'wisco-state-government',
      name: 'State Government',
      description:
        'The Wisconsin Legislature: a 33-member Senate with 4-year staggered terms and a 99-member Assembly with 2-year terms, 132 legislators total, meeting at the State Capitol in Madison. Each Senate district contains exactly three Assembly districts. Leadership titles: Senate President, Senate President Pro Tempore, Senate Majority and Minority Leaders, Assembly Speaker, Assembly Speaker Pro Tempore, Assembly Majority and Minority Leaders. The governor and lieutenant governor serve 4-year terms with no term limits, as do the attorney general, secretary of state, and state treasurer — five constitutional officers in all, elected in midterm years. Wisconsin\'s governor holds the nation\'s strongest partial veto over appropriation bills: the digit veto (Patrick Lucey struck the "2" from $25 million in 1973), the editing veto (Lucey removed the word "not" in 1975), the reduction veto (Tommy Thompson, 1993), and the 400-year school funding veto Tony Evers used in 2023 and the Wisconsin Supreme Court upheld in 2025. The Vanna White veto was banned by constitutional amendment in 1990 and the Frankenstein veto in 2008. A legislative override requires two-thirds of both chambers.',
    },
    {
      slug: 'wisco-constitution-courts',
      name: 'Constitution & Courts',
      description:
        'Wisconsin\'s first constitutional convention produced an 1846 draft that voters rejected as too radical — it would have granted married women property rights, put African American suffrage to referendum, and banned commercial banking outright. A second convention produced the document presented February 1, 1848 and ratified March 13, 1848, making it the oldest state constitution outside New England still in force. It has 14 articles and has been amended about 150 times. Amending it requires passage by both houses in two successive legislatures with an intervening election, then approval by the voters — no governor\'s signature. The governor gained line-item veto authority by amendment in 1930. The Wisconsin Supreme Court has seven justices elected statewide in nonpartisan spring elections to 10-year terms, and the justices themselves elect a chief justice to a 2-year term — a change from the old seniority rule. Below it sit the Court of Appeals and the circuit courts. Cover judicial selection, terms, and the amendment process.',
    },
    {
      slug: 'wisco-founding-statehood',
      name: 'Exploration & Statehood',
      description:
        'The Ho-Chunk, Menominee, Ojibwe, Potawatomi, and Sauk nations lived in Wisconsin before European contact; Aztalan shows a Mississippian-era settlement with long-distance trade around 1050 AD. Jean Nicolet arrived in 1634; Marquette and Joliet passed through in 1673 and Marquette recorded the river name as "Meskousing," which through French and English spellings became Wisconsin — a leading theory traces it to a Miami word meaning "it lies red," for the reddish sandstone along the Wisconsin River. The region passed through the Northwest Territory (1787), Indiana Territory, Illinois Territory, and Michigan Territory before Wisconsin Territory was created April 20, 1836. The Winnebago War of 1827 and the Black Hawk War of 1832 opened the southwest to lead miners, whose hillside burrows gave the state its Badger nickname. Wisconsin became the 30th state on May 29, 1848, with 28 counties already established; Nelson Dewey was the first governor. Roughly 91,000 Wisconsin troops served the Union in the Civil War, including the Iron Brigade.',
    },
    {
      slug: 'wisco-progressive-era',
      name: 'Progressive Era & Political Legacy',
      description:
        'Robert M. La Follette served as governor from 1901 to 1906 and as U.S. senator from 1906 to 1925, making Wisconsin a national laboratory for reform: the first statewide direct primary, the first workers\' compensation law, and an early state income tax. The Wisconsin Idea, articulated by University of Wisconsin president Charles Van Hise in 1904 — "I shall never be content until the beneficent influence of the University reaches every home in the state" — put university expertise directly into state policymaking and shaped New Deal programs including Social Security. The Republican Party traces a founding meeting to about 30 opponents of the Kansas-Nebraska Act who gathered at the Little White Schoolhouse in Ripon on March 20, 1854 — a claim contested by Jackson, Michigan and Crawfordsville, Iowa, so always frame it as a claim. Wisconsin also sent Joseph McCarthy to the U.S. Senate. Focus on statewide political history and institutions, never on any one city\'s politics.',
    },
    {
      slug: 'wisco-geography-symbols',
      name: 'Geography & State Symbols',
      description:
        'Wisconsin covers about 65,500 square miles, 23rd largest, and ranks 21st in population at roughly 5.97 million. It borders Lake Superior and Michigan to the north, Lake Michigan to the east, Illinois to the south, and Iowa and Minnesota to the west, with over 500 miles of Great Lakes shoreline. Timms Hill in Price County is the highest point at 1,951.5 feet; the Lake Michigan shore at 577 feet is the lowest. Five geographic regions: Lake Superior Lowland, Northern Highland, Central Plain, Eastern Ridges and Lowlands, and Western Upland. The Driftless Area in the southwest escaped the most recent glaciation, which is why it has no glacial drift and keeps its deep unglaciated valleys. The Wisconsin Glaciation — the most recent North American ice age — is named for the state, and left the Wisconsin Dells, Devil\'s Lake, and the Kettle Moraine. Wisconsin has over 15,000 named lakes; Lake Winnebago is the largest inland lake at over 137,700 acres. The Niagara Escarpment forms the spine of the Door Peninsula. Apostle Islands National Lakeshore has 21 islands. Wisconsin has 72 counties. State symbols with adoption years: motto "Forward" (1851), flag (1863), seal (1881), wood violet (flower, 1909), American robin (bird, 1949), sugar maple (tree, 1949), muskellunge (fish, 1955), badger (animal, 1957), white-tailed deer (wildlife animal, 1957), galena (mineral, 1971), granite (rock, 1971), dairy cow (domestic animal, 1971), mourning dove (symbol of peace, 1971), western honey bee (insect, 1977), Antigo silt loam (soil, 1983), trilobite (fossil, 1985), American water spaniel (dog, 1985), milk (beverage, 1987), corn (grain, 1989), polka (dance, 1993), cranberry (fruit, 2003), kringle (pastry, 2013), and the brandy old fashioned (cocktail, 2023). The state song is "On, Wisconsin!" (1959).',
    },
    {
      slug: 'wisco-agriculture-economy',
      name: 'Agriculture & Economy',
      description:
        '"America\'s Dairyland" became the official state slogan in 1940 and went onto license plates; a dairy farm graphic was added in 1986. Wisconsin makes about 26% of all U.S. cheese, roughly 3.39 billion pounds a year, was the first state to grade cheese by quality in 1921, and is the only state that requires a cheesemaker license to make cheese commercially. It grows about 60% of the nation\'s cranberries and 97% of its ginseng, both national leads. More than 7,000 dairy farms produce about 2.44 billion pounds of milk a month; California passed Wisconsin in total milk production in 1993, leaving Wisconsin second. Wisconsin leads the country in corn for silage and snap beans for processing and ranks high in oats, potatoes, carrots, tart cherries, maple syrup, and sweet corn. Beyond agriculture the economy runs on manufacturing, health care, information technology, brewing, and tourism, with a 2020 gross state product around $348 billion and 2023 median household income near $74,600. Keep questions statewide — do not attribute an industry to a single city.',
    },
    {
      slug: 'wisco-capitol-university',
      name: 'The Capitol & the State University',
      description:
        'The Wisconsin State Capitol in Madison was designed by George B. Post & Sons of New York, chosen by competition in February 1906, and built in stages from 1906 to 1917 for $7.25 million. It stands 284 feet 5 inches from the ground floor to the top of the statue and carries the largest granite dome in the world, faced in Bethel white granite from Vermont. Daniel Chester French sculpted the bronze statue "Wisconsin," completed in 1920, 15 feet 5 inches tall and three tons, holding a globe topped by an eagle and wearing a helmet with a badger on it — it is often confused with the separate "Forward" statue on the grounds. The building is X-shaped with four wings: East for the Supreme Court, West for the Assembly, South for the Senate, and North, around a central rotunda, using 43 kinds of stone from six countries and eight states. Edwin Howland Blashfield painted "Resources of Wisconsin" on the rotunda ceiling. Two earlier capitols preceded it; the second burned February 26, 1904 when a gas jet ignited a newly varnished ceiling. It was listed on the National Register October 15, 1970 and made a National Historic Landmark January 3, 2001. A 1990 law bars any structure within one mile of the Capitol from exceeding 1,032.8 feet above sea level, the elevation of the base of the dome columns. The University of Wisconsin–Madison was created July 26, 1848, the year of statehood, signed into being by Governor Nelson Dewey, with 17 students in its first class in February 1849; the Legislature designated it the state\'s land-grant institution in 1866. It is the flagship of the University of Wisconsin System. Discoveries there include vitamin A and B research, vitamin D enrichment in 1923, warfarin in the 1940s, and human embryonic stem cell isolation in 1998. Do not write about the campus as a Madison city landmark or about athletics traditions that a city collection could own.',
    },
  ],

  // Sums to 100
  topicDistribution: {
    'wisco-state-government': 20,
    'wisco-constitution-courts': 13,
    'wisco-founding-statehood': 16,
    'wisco-progressive-era': 13,
    'wisco-geography-symbols': 18,
    'wisco-agriculture-economy': 10,
    'wisco-capitol-university': 10,
  },

  officeholders: [
    { name: 'Tony Evers', role: 'Governor', termEnd: '2027-01-04T00:00:00Z' },
    { name: 'Sara Rodriguez', role: 'Lieutenant Governor', termEnd: '2027-01-04T00:00:00Z' },
    { name: 'Josh Kaul', role: 'Attorney General', termEnd: '2027-01-04T00:00:00Z' },
    { name: 'Sarah Godlewski', role: 'Secretary of State', termEnd: '2027-01-04T00:00:00Z' },
    { name: 'John S. Leiber', role: 'State Treasurer', termEnd: '2027-01-04T00:00:00Z' },
    {
      name: 'Jill J. Karofsky',
      role: 'Chief Justice, Wisconsin Supreme Court',
      termEnd: '2027-04-30T00:00:00Z',
    },
    { name: 'Mary Felzkowski', role: 'Senate President', termEnd: '2027-01-04T00:00:00Z' },
    { name: 'Robin Vos', role: 'Speaker of the Assembly', termEnd: '2027-01-04T00:00:00Z' },
  ],

  sourceUrls: [
    'https://en.wikipedia.org/wiki/Wisconsin',
    'https://en.wikipedia.org/wiki/History_of_Wisconsin',
    'https://en.wikipedia.org/wiki/Wisconsin_Legislature',
    'https://en.wikipedia.org/wiki/Constitution_of_Wisconsin',
    'https://en.wikipedia.org/wiki/Wisconsin_State_Capitol',
    'https://en.wikipedia.org/wiki/Geography_of_Wisconsin',
    'https://en.wikipedia.org/wiki/List_of_Wisconsin_state_symbols',
    'https://en.wikipedia.org/wiki/List_of_counties_in_Wisconsin',
    'https://en.wikipedia.org/wiki/Agriculture_in_Wisconsin',
    'https://en.wikipedia.org/wiki/Ripon,_Wisconsin',
    'https://en.wikipedia.org/wiki/University_of_Wisconsin%E2%80%93Madison',
    'https://en.wikipedia.org/wiki/Line-item_veto_in_the_United_States',
  ],
};
