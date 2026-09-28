import type { LocaleConfig } from './bloomington-in.js';

/**
 * Missouri state locale configuration for civic trivia question generation.
 *
 * CRITICAL ACCURACY NOTES:
 * - STATE-SCALE ONLY. Every question must be about statewide government, history,
 *   geography, or symbols. NO city-specific local government questions.
 * - Test: "Could a future city collection own this question?" If yes → cut it.
 * - St. Louis Gateway Arch is OK (statewide/national monument). St. Louis mayor is NOT OK.
 * - Kansas City is only OK for state-level context (e.g., "Missouri's largest city").
 * - Jefferson City questions (capital, legislature, capitol building) = OK.
 * - Mark Twain (stateborn, statewide literary figure) = OK.
 * - Missouri Compromise, Dred Scott case, Civil War border state history = OK.
 * - Current Governor: Mike Kehoe (58th Governor, sworn January 13, 2025).
 * - Missouri is the 24th state (admitted August 10, 1821).
 * - Missouri General Assembly: 34-member Senate + 163-member House.
 * - Term limits: 8 years per chamber (or 16 years total).
 * - Missouri borders 8 states — tied with Tennessee for most of any U.S. state.
 * - ALL officeholder questions MUST have expiresAt set.
 * - No addresses or phone numbers in answer options (quality rule).
 *
 * CURRENT OFFICEHOLDERS (verify before activating):
 * - Governor: Mike Kehoe (R, sworn January 13, 2025; ~term ends 2029-01-13)
 * - Lt. Governor: David Wasinger (R)
 * - Secretary of State: Denny Hoskins (R)
 * - Attorney General: Catherine Hanaway (R, appointed August 2025; first woman)
 * - State Treasurer: Vivek Malek
 * - Senate President Pro Tem: Cindy O'Laughlin (R, first woman in role, 2025)
 * - House Speaker: Jon Patterson (R, first Asian-American Speaker, Lee's Summit)
 */
export const missouriConfig: LocaleConfig = {
  locale: 'missouri',
  name: 'Missouri',
  externalIdPrefix: 'misso',
  collectionSlug: 'missouri',
  targetQuestions: 130,
  batchSize: 25,
  overshootFactor: 1.4,

  topicCategories: [
    {
      slug: 'state-government',
      name: 'State Government',
      description:
        'Missouri has a bicameral General Assembly: 34-member Senate (4-year terms) and 163-member House (2-year terms). Term limits: 8 years per chamber OR 16 years total. Governor Mike Kehoe (58th, R) sworn January 13, 2025. Lt. Governor David Wasinger (R). Secretary of State Denny Hoskins (R). Attorney General Catherine Hanaway (R, appointed August 2025; first woman to hold this office). State Treasurer Vivek Malek. Senate President Pro Tem Cindy O\'Laughlin (R, first woman elected to this role, 2025). House Speaker Jon Patterson (R, first Asian-American Speaker, elected 152-10 in January 2025, from Lee\'s Summit). Missouri Supreme Court: 7 judges; merit-based nonpartisan selection since 1940; governor appoints from 3 finalists; 12-year retention terms. Write questions about: General Assembly structure, term limits, governor powers, current officeholders, Supreme Court merit selection, number of Senate/House members.',
    },
    {
      slug: 'state-capitol',
      name: 'State Capitol & Jefferson City',
      description:
        'Jefferson City has been Missouri\'s capital since 1821 — the first U.S. city specifically created to be a state capital. Named for Thomas Jefferson (legislature considered "Missouriopolis"). Founded in 1821 by Daniel M. Boone, son of frontiersman Daniel Boone. Population: 43,228 (2020). The Missouri State Capitol was completed in 1917 and officially dedicated October 6, 1924. Architectural style: Roman Renaissance. Designed by Tracy and Swartwout (NYC firm). Features a prominent dome, 8 columns (48-foot) on the south portico, 13-by-18-foot bronze doors on south side. Contains murals by Missouri-born painter Thomas Hart Benton. This is the 3rd capitol in Jefferson City and 6th overall in Missouri history. The previous capitol burned in 1837 (destroying all government records). First legislative session in Jefferson City: 1826. Write questions about: capital designation year, why Jefferson City was named that, Boone connection, capitol completion year, dedication year, architectural style, Thomas Hart Benton murals, 6th overall capitol.',
    },
    {
      slug: 'statehood-history',
      name: 'Statehood & Historical Events',
      description:
        'Missouri admitted as 24th state on August 10, 1821 (signed by President James Monroe). First state entirely west of the Mississippi River admitted to the Union. Louisiana Purchase of 1803 brought Missouri\'s territory into U.S. hands. Missouri Compromise (passed March 3, 1820; signed March 6, 1820 by Monroe): Missouri admitted as slave state; Maine as free state; slavery prohibited north of 36°30′ parallel. Architect: Senator Henry Clay of Kentucky. Kansas-Nebraska Act (1854) effectively repealed it; Dred Scott v. Sandford (1857) declared it unconstitutional. Dred Scott: enslaved man who sued for freedom in St. Louis (1846); Supreme Court ruled 7-2 (March 6, 1857) that enslaved people were not citizens. 13th and 14th Amendments overturned the ruling. Missouri was a Civil War border state that sent armies to both sides. Slavery in Missouri began in 1720; abolished January 1865. Write questions about: statehood date Aug 10 1821, 24th state, first state west of Mississippi, Monroe, Missouri Compromise provisions and architect, 36°30′ line, Dred Scott ruling, border state Civil War role.',
    },
    {
      slug: 'geography-nature',
      name: 'Geography & Natural Features',
      description:
        'Missouri borders 8 states (tied with Tennessee for most): Iowa (N), Illinois/Kentucky/Tennessee (E across Mississippi), Arkansas (S), Oklahoma/Kansas/Nebraska (W). "The Show-Me State" nickname popularized by Congressman Willard Duncan Vandiver\'s 1899 speech: "I\'m from Missouri. You have to show me." Missouri River: nation\'s longest (2,341 miles total); 430 miles within Missouri; rises in Montana; enters Mississippi north of St. Louis. Highest point: Taum Sauk Mountain (1,772 feet / 540 m) in St. Francois Mountains west of Ironton. Ozark Mountains/Highlands cover ~33,000 sq mi of Missouri. Missouri has 7,300+ recorded caves — "The Cave State," second only to Tennessee. 2025 population: ~6.215 million. Largest cities: Kansas City (510,612), St. Louis (288,512), Springfield (169,954). Write questions about: 8 bordering states, "Show-Me State" Vandiver origin, Missouri River length, Taum Sauk Mountain, cave count nickname, largest cities by population rank.',
    },
    {
      slug: 'state-symbols',
      name: 'State Symbols & Notable Figures',
      description:
        'State bird: Eastern Bluebird. State flower: White Hawthorn Blossom. State tree: Flowering Dogwood. State motto: "Salus Populi Suprema Lex Esto" (The welfare of the people shall be the supreme law). Nickname: "The Show-Me State." Lewis and Clark Corps of Discovery departed May 14, 1804 from Camp Dubois/St. Charles, Missouri, up the Missouri River; traveled ~8,000 miles; returned September 23, 1806. Members included York (enslaved by Clark) and Sacagawea. Mark Twain (Samuel Clemens) born 1835 in Florida, Missouri (20 miles west of Hannibal). Moved to Hannibal at age 4 in 1839; lived there until 1853. Adventures of Tom Sawyer (1876) and Adventures of Huckleberry Finn (1884) inspired by his boyhood in Hannibal. Gateway Arch National Park: redesignated as national park in 2018 (previously Jefferson National Expansion Memorial). Write questions about: state bird/flower/tree/motto, Lewis & Clark departure from Missouri (May 14, 1804), Mark Twain birthplace (Florida, MO), Twain novels, Gateway Arch National Park redesignation year.',
    },
  ],

  topicDistribution: {
    'state-government': 22,
    'state-capitol': 15,
    'statehood-history': 25,
    'geography-nature': 20,
    'state-symbols': 18,
  },

  officeholders: [
    { name: 'Mike Kehoe', role: 'Governor (58th)', termEnd: '2029-01-13T00:00:00Z' },
    { name: 'David Wasinger', role: 'Lieutenant Governor', termEnd: '2029-01-13T00:00:00Z' },
    { name: 'Denny Hoskins', role: 'Secretary of State', termEnd: '2029-01-13T00:00:00Z' },
    { name: 'Catherine Hanaway', role: 'Attorney General', termEnd: '2029-01-13T00:00:00Z' },
    { name: 'Vivek Malek', role: 'State Treasurer', termEnd: '2029-01-13T00:00:00Z' },
    { name: "Cindy O'Laughlin", role: 'Senate President Pro Tem', termEnd: '2027-01-12T00:00:00Z' },
    { name: 'Jon Patterson', role: 'House Speaker', termEnd: '2027-01-12T00:00:00Z' },
    // Added 2026-09-28, both verified that day. Note the two DIFFERENT clocks:
    // the State Auditor is the one statewide office Missouri fills in a midterm
    // year, and the Chief Justice is chosen by the court from among its own
    // judges on a rotating term. Neither belongs on the January-2029 date the
    // rest of the executive roster shares — that is the phoenix-az lesson.
    { name: 'Scott Fitzpatrick', role: 'State Auditor', termEnd: '2027-01-11T00:00:00Z' },
    { name: 'W. Brent Powell', role: 'Chief Justice, Supreme Court of Missouri', termEnd: '2027-07-01T00:00:00Z' },
  ],

  sourceUrls: [
    'https://en.wikipedia.org/wiki/Missouri',
    'https://en.wikipedia.org/wiki/Missouri_State_Capitol',
    'https://en.wikipedia.org/wiki/Jefferson_City,_Missouri',
    'https://en.wikipedia.org/wiki/Missouri_Compromise',
    'https://en.wikipedia.org/wiki/Dred_Scott_v._Sandford',
    'https://en.wikipedia.org/wiki/Missouri_General_Assembly',
    'https://en.wikipedia.org/wiki/Lewis_and_Clark_Expedition',
    'https://en.wikipedia.org/wiki/Geography_of_Missouri',
  ],
};
