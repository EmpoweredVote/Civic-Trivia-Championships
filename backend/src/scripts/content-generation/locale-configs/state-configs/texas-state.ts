import type { LocaleConfig } from '../bloomington-in.js';

/**
 * Texas state configuration for civic trivia question generation.
 * Used by generate-locale-questions.ts to produce the Texas State collection.
 *
 * CRITICAL ACCURACY NOTES:
 * - The legislature meets biennially (odd-numbered years only), 140-day constitutional limit
 * - Lt. Governor is President of the Senate with outsized power (sets agenda, appoints committees)
 * - Texas has TWO courts of last resort: Supreme Court (civil) and Court of Criminal Appeals (criminal)
 * - Railroad Commission regulates oil/gas, NOT railroads (since 2005)
 * - Plural executive: Governor, Lt. Gov, AG, Comptroller, Land Commissioner, Ag Commissioner, RRC all elected separately
 * - 1876 Constitution is still in effect -- longest in US (80,000+ words, hundreds of amendments)
 * - State-only: no questions about specific Texas cities (Austin state institutions are OK)
 * - MIXED DURABILITY: generate both expiring (current-officeholder) and durable questions
 */
export const texasStateConfig: LocaleConfig = {
  locale: 'texas-state',
  name: 'Texas',
  externalIdPrefix: 'tex',
  collectionSlug: 'texas-state',
  targetQuestions: 70,
  overshootFactor: 1.3,
  batchSize: 25,

  topicCategories: [
    // Government Structure (~37%)
    {
      slug: 'state-legislature',
      name: 'Texas Legislature',
      description: 'Bicameral legislature: 31-member Senate and 150-member House of Representatives. Biennial regular sessions (odd years only, 140-day constitutional limit). Special sessions called by Governor. Redistricting, legislative process, leadership positions.',
    },
    {
      slug: 'governor-executive',
      name: 'Governor & Executive',
      description: 'Governor, plural executive offices (Lt. Governor, Attorney General, Comptroller, Land Commissioner, Agriculture Commissioner, Secretary of State). Term lengths, executive powers, appointment authority. Secretary of State is the only statewide officer NOT elected.',
    },
    {
      slug: 'distinctive-institutions',
      name: 'Texas Institutions',
      description: "Texas's uniquely distinctive civic institutions: Railroad Commission (founded 1891 to regulate railroads, now regulates oil/gas/pipeline safety, no longer regulates railroads since 2005), Lt. Governor's outsized Senate power (sets agenda, appoints committees, chairs Legislative Budget Board), Comptroller's fiscal role in plural executive, two courts of last resort split.",
    },
    // History & Identity (~17%)
    {
      slug: 'texas-history-identity',
      name: 'Texas History & Identity',
      description: 'Republic of Texas (1836-1845, 9 years of independence), Sam Houston (President twice, first Governor, removed for refusing Confederate oath), annexation, secession and readmission, Juneteenth (June 19, 1865 -- federal troops announce emancipation in Galveston). State-level civic history only.',
    },
    // Courts & Constitution (~17%)
    {
      slug: 'state-judiciary',
      name: 'Texas Courts',
      description: 'Two courts of last resort: Texas Supreme Court (civil/juvenile) and Court of Criminal Appeals (criminal/death penalty) -- only Texas and Oklahoma have this split. District courts, courts of appeals. Judicial selection: partisan elections for all judges.',
    },
    {
      slug: 'texas-constitution',
      name: 'Texas Constitution',
      description: '1876 Constitution -- current constitution, longest in US at 80,000+ words with 17 articles and hundreds of amendments. Drafted in reaction to Reconstruction-era 1869 Constitution. Amendment process requires two-thirds of each chamber plus voter approval. Constitutional convention history.',
    },
    // Public Policy & Landmarks (~29%)
    {
      slug: 'civic-landmarks',
      name: 'Texas Civic Landmarks',
      description: "Texas State Capitol (completed 1888, 302.64 ft tall -- intentionally 14.64 ft taller than the US Capitol at 288 ft), Governor's Mansion (1856, oldest continuously occupied governor's residence west of the Mississippi), the Alamo (state-level civic significance as symbol of Texas independence).",
    },
    {
      slug: 'public-policy',
      name: 'Texas Public Policy',
      description: 'Energy policy (ERCOT -- Texas has its own electric grid, largely deregulated since 2002), fiscal policy (no state income tax -- relies on property and sales tax), water rights (prior appropriation in western TX, riparian in eastern TX), land management (General Land Office, school fund).',
    },
  ],

  topicDistribution: {
    // Government Structure (26 questions)
    'state-legislature': 14,
    'governor-executive': 12,
    // Distinctive Institutions (10 questions)
    'distinctive-institutions': 10,
    // History & Identity (12 questions)
    'texas-history-identity': 12,
    // Courts & Constitution (12 questions)
    'state-judiciary': 6,
    'texas-constitution': 6,
    // Public Policy & Landmarks (10 questions)
    'civic-landmarks': 5,
    'public-policy': 5,
  },

  // ⚠ RE-VERIFY THIS ROSTER AFTER 3 NOVEMBER 2026. Texas fills every statewide
  // executive office in midterm years, so the whole executive branch is on that
  // ballot at once and the January-2027 entries below will almost all change:
  // as of 2026-09-28 the Attorney General is not seeking re-election (running
  // for U.S. Senate), the Agriculture Commissioner and the Railroad Commission
  // chair-elect both LOST their primaries this year, and the Comptroller
  // resigned on 31 July 2026 — which is why no Comptroller or Agriculture
  // entry appears here at all.
  //
  // The two 2031 entries are the stable ones: Railroad Commissioners and Court
  // of Criminal Appeals judges run on six-year staggered terms, so they are the
  // right offices to hang durable expiring content on. Verified 2026-09-28.
  officeholders: [
    { name: 'Greg Abbott', role: 'Governor', termEnd: '2027-01-19T00:00:00Z' },
    { name: 'Dan Patrick', role: 'Lieutenant Governor', termEnd: '2027-01-19T00:00:00Z' },
    { name: 'Ken Paxton', role: 'Attorney General', termEnd: '2027-01-19T00:00:00Z' },
    { name: 'Dawn Buckingham', role: 'Land Commissioner', termEnd: '2027-01-19T00:00:00Z' },
    { name: 'Dustin Burrows', role: 'Speaker of the Texas House', termEnd: '2027-01-12T00:00:00Z' },
    { name: 'Christi Craddick', role: 'Chair, Railroad Commission of Texas', termEnd: '2031-01-01T00:00:00Z' },
    { name: 'David J. Schenck', role: 'Presiding Judge, Court of Criminal Appeals', termEnd: '2031-01-01T00:00:00Z' },
  ],

  sourceUrls: [
    // Legislature
    'https://capitol.texas.gov',
    'https://www.senate.texas.gov',
    'https://www.house.texas.gov',
    // Governor & Executive
    'https://gov.texas.gov',
    'https://www.sos.state.tx.us',
    'https://www.texasattorneygeneral.gov',
    // History
    'https://www.tshaonline.org',
    'https://tarltonapps.law.utexas.edu',
    // Courts
    'https://www.txcourts.gov',
    // Civic Landmarks
    'https://tspb.texas.gov',
    'https://www.thc.texas.gov',
    // Policy
    'https://www.rrc.texas.gov',
    'https://comptroller.cpa.state.tx.us',
    'https://www.ercot.com',
    // Supplementary
    'https://en.wikipedia.org/wiki/Texas',
    'https://en.wikipedia.org/wiki/Texas_Legislature',
    'https://en.wikipedia.org/wiki/Texas_State_Capitol',
    'https://en.wikipedia.org/wiki/Constitution_of_Texas',
  ],
};

/**
 * Texas-specific features to inject into state system prompt.
 * This string is passed to buildStateSystemPrompt() and serves as all voice guidance
 * for Texas question generation. No changes to system-prompt.ts are needed.
 *
 * KEY INNOVATION: This is the FIRST collection to use the mixed-durability pattern.
 * Both durable and expiring questions are generated, with expiresAt set per question.
 */
export const texasStateFeatures = `
Texas has several unique features in its state government that MUST be accurately represented:

**MIXED DURABILITY INSTRUCTION (NEW PATTERN)**
Generate a mix of durable civic facts and expiring current-officeholder questions. This is intentional -- both types add civic value.
- For current officeholders and time-sensitive facts, set expiresAt to the end of their current term
- All statewide elected officials face election in November 2026; terms expire approximately January 19, 2027
- Set expiresAt: "2027-01-19T00:00:00Z" for all current-officeholder questions
- For durable structural/historical facts, set expiresAt: null
- No fixed ratio required -- generate as many of each as make good trivia
- "Who is the Lt. Governor of Texas?" is an example of a compelling expiring question we WANT

**CRITICAL: STATE-ONLY RULE**
- ALL questions must be about Texas statewide institutions, laws, events, or history
- Do NOT reference specific Texas cities in any question
- Austin STATE institutions are acceptable (the Capitol, Governor's Mansion, state agencies housed in Austin)
- Austin CITY facts are NOT acceptable (Austin city council, Austin mayor, Austin local services)
- Other cities explicitly excluded: Dallas, Houston, San Antonio, Fort Worth, El Paso, Plano, Arlington -- no city government, city history, or city-specific facts
- If a fact is about a city that happens to be in Texas, it does NOT belong in this collection

**TEXAS LEGISLATURE**
- Bicameral: 31 Senate members (4-year terms) and 150 House of Representatives members (2-year terms)
- Biennial regular sessions: meets only in ODD-numbered years, 140-day constitutional limit
- The 89th Legislature convened January 14, 2025 and must adjourn by June 2, 2025
- The 90th Legislature will not convene until January 2027
- NEVER say "annual sessions" -- Texas has biennial regular sessions
- Governor may call special sessions (30-day limit per session, no limit on number of sessions)
- Speaker of the House: Dade Phelan (as of 89th Legislature)

**LT. GOVERNOR'S OUTSIZED POWER**
- The Lt. Governor serves as President of the Texas Senate
- Sets the Senate agenda, appoints all Senate committee chairs and members
- Chairs the Legislative Budget Board (controls state budget process)
- Arguably more powerful than the Governor in legislative matters -- this is a distinctive Texas civic fact
- Lt. Governor: Dan Patrick (R) -- term expires January 2027 -> expiresAt: "2027-01-19T00:00:00Z"

**PLURAL EXECUTIVE**
- Texas has a plural executive: Governor, Lt. Governor, Attorney General, Comptroller, Land Commissioner, Agriculture Commissioner, Railroad Commissioners are ALL elected separately
- They do NOT report to the Governor and may be from different parties
- Secretary of State is the ONLY statewide officer appointed (not elected) -- appointed by the Governor
- Governor: Greg Abbott (R) -- third term, entered office January 2015 -> expiresAt: "2027-01-19T00:00:00Z"
- Attorney General: Ken Paxton (R) -- third term -> expiresAt: "2027-01-19T00:00:00Z" (running for US Senate, not AG re-election)
- Comptroller: CAUTION -- Glenn Hegar resigned February 2025; Kelly Hancock is acting Comptroller. Focus Comptroller questions on the ROLE and POWERS of the office, not the current officeholder. If generating a "Who is the Comptroller?" question, flag it for manual review.
- Secretary of State: Jane Nelson (R) -- appointed by Abbott; the only statewide officer NOT elected -> expiresAt: "2027-01-19T00:00:00Z"

**RAILROAD COMMISSION**
- Founded in 1891 to regulate railroads
- Now regulates oil, gas, and pipeline safety -- has NOT regulated railroads since 2005 (federal preemption)
- Three elected commissioners (6-year staggered terms)
- Despite its name, it is one of the most powerful energy regulators in the US
- The name/function mismatch is excellent trivia material

**TWO COURTS OF LAST RESORT**
- Texas Supreme Court: highest court for CIVIL and JUVENILE cases (9 justices)
- Court of Criminal Appeals: highest court for CRIMINAL cases including death penalty (9 judges)
- Only Texas and Oklahoma have this dual-court structure -- genuinely distinctive
- All Texas judges are elected in PARTISAN elections

**1876 CONSTITUTION**
- Current Texas Constitution, ratified February 15, 1876
- Drafted as a reaction to the Reconstruction-era 1869 Constitution (seen as too centralized)
- Longest state constitution in the US: 80,000+ words, 17 articles
- Hundreds of amendments (over 500 proposed, most approved by voters)
- Amendment process: two-thirds vote in each chamber of the legislature, then voter approval at election
- The length and amendment frequency are distinctive -- it is essentially a policy document, not just a framework

**TEXAS HISTORY AND IDENTITY**
- Republic of Texas: 1836-1845 (9 years as an independent nation)
- Sam Houston: President of the Republic of Texas twice (1836-38, 1841-44); first Governor of the State of Texas; removed as Governor in 1861 for refusing to take the Confederate oath -- excellent civic story
- Annexation: Texas joined the US in 1845 by joint resolution of Congress
- Juneteenth: June 19, 1865 -- Union General Gordon Granger arrived in Galveston and announced emancipation, more than two years after the Emancipation Proclamation. Juneteenth originated as a Texas celebration before becoming a federal holiday in 2021.
- Secession (1861) and readmission (1870) -- frame as civic history, not political argument

**CIVIC LANDMARKS**
- Texas State Capitol: completed 1888, 302.64 feet tall -- intentionally built 14.64 feet taller than the US Capitol (288 ft). This is a signature civic trivia fact.
- Governor's Mansion: built 1856, oldest continuously occupied governor's residence west of the Mississippi
- The Alamo: San Antonio landmark, symbol of Texas independence (Battle of the Alamo, 1836) -- acceptable as state-level civic symbol, NOT as San Antonio city trivia

**PUBLIC POLICY HOOKS**
- ERCOT: Texas operates its own electric grid (the Texas Interconnection), managed by ERCOT, largely separate from the two main US grids. Deregulated retail electricity market since 2002.
- No state income tax: Texas relies on sales tax and property tax. The Comptroller certifies the state budget (revenue estimate).
- Water rights: dual system -- prior appropriation in western Texas, riparian rights in eastern Texas. Water is a major civic issue.
- General Land Office: manages state-owned lands including the Permanent School Fund (one of the largest educational endowments in the US)

**WHAT TO AVOID**
- Do NOT write questions about specific Texas city governments (Houston city council, Dallas mayor, etc.)
- Do NOT write questions about Texas sports teams, private companies, or universities as institutions
- Do NOT write questions about US Senators Ted Cruz or John Cornyn -- they are federal subjects, not state subjects
- Do NOT write questions whose answer is a phone number, street address, or budget figure
- Do NOT say "annual sessions" -- Texas has BIENNIAL sessions
- Apply the dinner party test: "Is this a surprising, shareable civic tidbit?" PASS: "What Texas agency was founded to regulate railroads but now regulates oil and gas?" FAIL: "What is the annual budget of the Texas Department of Transportation?"
`;
