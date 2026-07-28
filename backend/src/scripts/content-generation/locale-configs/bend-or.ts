import type { LocaleConfig } from './bloomington-in.js';

/**
 * Bend, OR locale configuration for civic trivia question generation.
 *
 * CRITICAL ACCURACY NOTES:
 * - Bend uses the COUNCIL–MANAGER form, adopted in 1929. The CITY MANAGER is the
 *   chief executive who runs day-to-day operations; the mayor is not. Never
 *   describe Bend's mayor as running the city's departments.
 * - The City Council has SEVEN members — six councilors plus the mayor — and all
 *   seats are elected AT-LARGE. Bend has NO wards or districts. A 2018 charter
 *   review considered a ward system and it was rejected. Never write a question
 *   implying Bend councilors represent geographic districts.
 * - Seats are NUMBERED 1 through 7; the mayor holds Seat 7. Terms are 4 years and
 *   staggered: Seats 1–4 were elected in November 2024 (terms January 2025 to
 *   January 2029); Seats 5, 6 and the mayor are on the November 2026 ballot.
 * - The mayor has been DIRECTLY ELECTED only since voters approved a charter
 *   amendment in May 2018. Under the 1928 charter the councilors picked one of
 *   their own as mayor for a 2-year term. Sally Russell was the first directly
 *   elected mayor. This before/after distinction is good question material — do
 *   not describe direct election as long-standing.
 * - Oregon municipal elections are NONPARTISAN.
 * - SEPARATE GOVERNMENTS — do not attribute these to the City of Bend:
 *   • BEND PARK & RECREATION DISTRICT is an independent special district with its
 *     own five-member elected board and its own taxing authority. It runs the
 *     parks and trails, NOT the city.
 *   • BEND–LA PINE SCHOOLS is a separate school district.
 *   • DESCHUTES COUNTY (created 1916) is separate; Bend is its county seat.
 * - AIRPORT TRAP: commercial airline service for Bend is at ROBERTS FIELD (RDM)
 *   in REDMOND, a different city. Bend Municipal Airport is general aviation
 *   only. Never call Roberts Field "Bend's airport" without the Redmond
 *   qualifier.
 * - NAME CHANGE: the Old Mill District concert venue built in 2001 as the LES
 *   SCHWAB AMPHITHEATER is now the HAYDEN HOMES AMPHITHEATER. Do not present the
 *   old name as current.
 * - CONTESTED FACTOID — do not use: the claim that Bend is "one of only N U.S.
 *   cities with a volcano inside city limits." Sources disagree on the count
 *   (three vs. six). Ask what Pilot Butte IS (a cinder cone) instead of how rare
 *   that is.
 * - NOT IN THE CITY: Newberry Volcano is about 20 miles SOUTH of Bend and Mount
 *   Bachelor about 22 miles WEST. Pilot Butte is the one inside city limits.
 *   Always place these correctly.
 * - STATE/CITY BOUNDARY (hard rule): the Oregon state collection (`oregon-state`)
 *   and the Portland collection (`portland-or`) already exist and contain zero
 *   Bend content. Keep it that way: no Oregon state government, no Oregon
 *   governor or legislature, and nothing about Portland. Oregon's statewide land
 *   use system may be referenced ONLY as it applies to Bend's own urban growth
 *   boundary.
 * - ALL officeholder questions MUST have expiresAt set to the term end.
 * - Max 1 question per officeholder.
 * - No addresses or phone numbers in answer options (quality rule).
 * - No political party labels anywhere.
 *
 * EXPIRING-RATIO NOTE: Bend's seven-member at-large council yields far fewer
 * officeholders than a large-council city. Coverage here is the full council,
 * the city manager, the schools superintendent, and the park district's director
 * and three named board members — 13 in an 86-question pool (15.1%). That is the
 * practical ceiling without inventing officials; do not pad it.
 *
 * CURRENT OFFICEHOLDERS:
 * - Mayor (Seat 7): Melanie Kebler — elected 2022, term ends January 2027
 * - Councilor, Seat 5: Ariel Méndez — term ends January 2027
 * - Councilor, Seat 6: Mike Riley — term ends January 2027
 * - Councilors (Seats 1–4, terms end January 2029): Megan Perkins, Megan Norris,
 *   Gina Franzosa, Steve Platt
 * - City Manager: Eric King (appointed 2008)
 * - Bend–La Pine Schools Superintendent: Dr. Steven Cook (since July 2025)
 * - BPRD Executive Director: Michelle Healy
 * - BPRD Board Chair: Donna Owens (term through June 30, 2027)
 * - BPRD Board Vice-Chair: Cary Schneider (term through June 30, 2029)
 * - BPRD Board Director: Nathan Hovekamp (term through June 30, 2029)
 *
 * DELIBERATELY OMITTED: the Bend police chief. As of late July 2026 the city was
 * in the middle of selecting a new chief, so any name would expire immediately.
 * Add one only after the appointment is confirmed.
 */
export const bendOrConfig: LocaleConfig = {
  locale: 'bend-or',
  name: 'Bend, OR',
  externalIdPrefix: 'benor',
  collectionSlug: 'bend-or',
  targetQuestions: 130,
  batchSize: 25,
  overshootFactor: 1.4,

  topicCategories: [
    {
      slug: 'benor-city-government',
      name: 'City Government',
      description:
        'Bend adopted the council–manager form of government in 1929. The City Council has seven members — six councilors and the mayor — all elected at-large to four-year terms, with no wards or districts anywhere in the city. Seats are numbered 1 through 7 and the mayor holds Seat 7; terms are staggered so Seats 1–4 and Seats 5–7 alternate election years. The city manager, not the mayor, is the chief executive who directs departments and staff. Voters restored direct election of the mayor by charter amendment in May 2018; before that the councilors selected one of their own for a two-year term, a practice set by the 1928 charter. Bend is the county seat of Deschutes County, which was created in 1916 and is a separate government. Oregon municipal elections are nonpartisan. Do NOT write about Oregon state government or Portland — separate collections own those.',
    },
    {
      slug: 'benor-founding-history',
      name: 'Founding & Early History',
      description:
        'Settlers in the 1870s found a fordable crossing where the Deschutes River bends. John Y. Todd bought land there and called it Farewell Bend Ranch; when John Sisemore applied for a post office in 1886 the U.S. Post Office Department shortened the name to Bend. Alexander Drake arrived at the turn of the century and drove the townsite\'s development; Drake Park on Mirror Pond carries his name. The town was platted May 28, 1904 and incorporated January 4, 1905, with A. H. Goodwillie as first mayor. Bend sits at about 3,642 feet in the Oregon High Desert, east of the Cascade Range. The Pilot Butte Development Company built the first commercial sawmill in 1901. Deschutes County was carved out in 1916 with Bend as its seat. Cover the naming, platting, incorporation, early institutions, and the railroad reaching town.',
    },
    {
      slug: 'benor-outdoors-parks-geology',
      name: 'Outdoors, Parks & Volcanic Geology',
      description:
        'Pilot Butte is a cinder cone inside Bend city limits, 4,142 feet in elevation and rising roughly 500 feet above the surrounding land; the 114-acre Pilot Butte State Scenic Viewpoint was given to Oregon in 1928 and a scenic road spirals to the summit. Thomas Clark named it in 1851 and it was once called Red Butte. Do NOT claim Bend is one of only N U.S. cities with a volcano inside its limits — sources conflict. Newberry Volcano lies about 20 miles south of Bend: a shield-shaped volcano, the largest in the Cascade Volcanic Arc, with a caldera 4 by 5 miles holding Paulina Lake and East Lake, Paulina Peak at 7,989 feet, and the Big Obsidian Flow from an eruption about 1,300 years ago. Newberry National Volcanic Monument was established by Congress in November 1990. Lava River Cave is Oregon\'s longest continuous lava tube and Lava Butte is a 500-foot cinder cone that erupted about 7,000 years ago. The Deschutes River runs through town and is dammed to form Mirror Pond. The Bend Park & Recreation District — an independent special district with a five-member elected board serving four-year terms, its own taxing authority, and its own executive director — runs the parks, the Deschutes River Trail, and Juniper Swim & Fitness Center. Emphasize that the park district is NOT a city department.',
    },
    {
      slug: 'benor-timber-recreation',
      name: 'From Timber to Recreation',
      description:
        'Two rival pine mills defined Bend for decades: Shevlin-Hixon opened on the west bank of the Deschutes in 1916 and Brooks-Scanlon built Mill A on the east bank. At their peak each employed more than 2,000 workers and cut more than 500 million board feet a year, among the largest pine sawmills in the world. Forest depletion closed Shevlin-Hixon in 1950 and Mill A in 1983, and the local economy collapsed before pivoting to tourism and recreation. Developer Bill Smith bought the 270-acre mill site in 1993 through William Smith Properties and rebuilt it as the Old Mill District, preserving three smokestacks and nine renovated structures including the Little Red Shed, the oldest, once used to store fire equipment. The district now holds roughly 60 stores and employs more than 2,500 people. The concert venue built there in 2001 as the Les Schwab Amphitheater is now the Hayden Homes Amphitheater and holds about 8,000 people. Mount Bachelor ski area, founded in 1958 by Bill Healy about 22 miles west of town, has a 9,065-foot summit and 4,323 acres of lift-accessible terrain, the second-largest single-mountain ski resort in the United States; POWDR Corporation has owned it since 2001.',
    },
    {
      slug: 'benor-growth-housing-water',
      name: 'Growth, Housing & Water',
      description:
        'Bend counted 99,178 residents in the 2020 census, sixth-largest in Oregon, in a metro area of roughly 261,000. Oregon requires every city to maintain an urban growth boundary, and Bend\'s has been the central fight in its planning politics: after work from 2014 to 2016 the city identified ten expansion areas and added 2,380 acres, approved unanimously by both the Bend City Council and the Deschutes County Board of Commissioners. Later one-off land additions have been allowed in exchange for requiring developers to build a share of affordable units. Cover the mechanics of the growth boundary, why a high-desert city rations land and water, housing affordability pressure from rapid in-migration, and the tension between growth and the Deschutes basin\'s limited water. Reference Oregon\'s statewide land use system only as it applies to Bend itself — the state collection owns Oregon land use policy in general.',
    },
    {
      slug: 'benor-beer-tourism',
      name: 'Craft Beer & Tourism',
      description:
        'Gary Fish founded Deschutes Brewery in 1988 as a small brewpub in downtown Bend at Bond Street and Greenwood Avenue, naming it for the river. Its flagships are Black Butte Porter — the best-selling craft porter in the United States, named for Black Butte — and Mirror Pond Pale Ale, named for the Deschutes impoundment in town, which took gold for pale ale at the 2010 Great American Beer Festival. Deschutes ranked eighth-largest craft brewery in the country as of 2016 and distributes to 28 states and beyond. Bend has more than 30 breweries and markets the Bend Ale Trail. Tourism generates over $1 billion a year for the regional economy, drawing on skiing, mountain biking, climbing, and river recreation. Major employers include St. Charles Health System, Bend–La Pine Schools, and Mount Bachelor. Bend also drew attention as the home of the last remaining Blockbuster Video store.',
    },
    {
      slug: 'benor-community-services',
      name: 'Community & Public Services',
      description:
        'Bend–La Pine Schools is a separate district from city government, running six high schools, six middle schools, and about 19 elementary schools, led by a superintendent hired by an elected school board. Higher education in town includes Central Oregon Community College and OSU-Cascades. Cascades East Transit provides the area\'s fixed-route bus service. Bend sits at the junction of U.S. Routes 20 and 97; a BNSF freight line runs through town but scheduled passenger rail service ended around 1968–1970. Commercial air service is at Roberts Field in Redmond, a separate city — Bend Municipal Airport handles general aviation only, and this distinction matters. St. Charles Health System is the largest employer in the region. Cover libraries, utilities, emergency services, schools, and transportation, always separating city services from those run by the county, the school district, or the park district.',
    },
  ],

  // Sums to 100
  topicDistribution: {
    'benor-city-government': 18,
    'benor-founding-history': 14,
    'benor-outdoors-parks-geology': 18,
    'benor-timber-recreation': 14,
    'benor-growth-housing-water': 12,
    'benor-beer-tourism': 12,
    'benor-community-services': 12,
  },

  officeholders: [
    { name: 'Melanie Kebler', role: 'Mayor', district: 'Seat 7', termEnd: '2027-01-01T00:00:00Z' },
    { name: 'Ariel Méndez', role: 'City Councilor', district: 'Seat 5', termEnd: '2027-01-01T00:00:00Z' },
    { name: 'Mike Riley', role: 'City Councilor', district: 'Seat 6', termEnd: '2027-01-01T00:00:00Z' },
    { name: 'Megan Perkins', role: 'City Councilor', termEnd: '2029-01-01T00:00:00Z' },
    { name: 'Megan Norris', role: 'City Councilor', termEnd: '2029-01-01T00:00:00Z' },
    { name: 'Gina Franzosa', role: 'City Councilor', termEnd: '2029-01-01T00:00:00Z' },
    { name: 'Steve Platt', role: 'City Councilor', termEnd: '2029-01-01T00:00:00Z' },
    { name: 'Eric King', role: 'City Manager', termEnd: '2027-01-01T00:00:00Z' },
    {
      name: 'Steven Cook',
      role: 'Superintendent, Bend–La Pine Schools',
      termEnd: '2027-01-01T00:00:00Z',
    },
    {
      name: 'Michelle Healy',
      role: 'Executive Director, Bend Park & Recreation District',
      termEnd: '2027-01-01T00:00:00Z',
    },
    {
      name: 'Donna Owens',
      role: 'Board Chair, Bend Park & Recreation District',
      termEnd: '2027-06-30T00:00:00Z',
    },
    {
      name: 'Cary Schneider',
      role: 'Board Vice-Chair, Bend Park & Recreation District',
      termEnd: '2029-06-30T00:00:00Z',
    },
    {
      name: 'Nathan Hovekamp',
      role: 'Board Director, Bend Park & Recreation District',
      termEnd: '2029-06-30T00:00:00Z',
    },
  ],

  sourceUrls: [
    'https://en.wikipedia.org/wiki/Bend,_Oregon',
    'https://en.wikipedia.org/wiki/Pilot_Butte_(Oregon)',
    'https://en.wikipedia.org/wiki/Newberry_Volcano',
    'https://en.wikipedia.org/wiki/Old_Mill_District',
    'https://en.wikipedia.org/wiki/Deschutes_Brewery',
    'https://en.wikipedia.org/wiki/Mount_Bachelor_ski_area',
    'https://en.wikipedia.org/wiki/Bend_Park_%26_Recreation_District',
    'https://en.wikipedia.org/wiki/List_of_mayors_of_Bend,_Oregon',
    'https://www.bendparksandrec.org/about/board-of-directors/',
  ],
};
