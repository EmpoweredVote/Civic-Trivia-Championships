import { QUALITY_GUIDELINES } from './quality-guidelines.js';
import type { OfficeholderEntry } from '../locale-configs/bloomington-in.js';

/**
 * Builds the officeholder block appended to system prompts when locale config
 * has a populated officeholders array. The "name them SPECIFICALLY" instruction
 * and "do NOT write 'the current mayor'" contrast are load-bearing for the
 * auto-seeder in Plan 02 — do not weaken this wording.
 */
export function buildOfficeholderBlock(officeholders: OfficeholderEntry[]): string {
  if (officeholders.length === 0) return '';
  const lines = officeholders.map(o => {
    const districtPart = o.district ? `, ${o.district}` : '';
    return `  - ${o.role}${districtPart}: ${o.name} (term ends ${o.termEnd.split('T')[0]})`;
  }).join('\n');
  return `\n\n## OFFICEHOLDERS\n\nThese are active, named officials. Generate questions that name them SPECIFICALLY\n(use their exact name — do NOT write "the current mayor" or "the current council member").\nSet expiresAt to the term end date shown for each person.\n\n${lines}`;
}

/**
 * Builds the system prompt for civic trivia question generation.
 * Encodes all content decisions from 17-CONTEXT.md.
 */
export function buildSystemPrompt(
  localeName: string,
  topicDistribution: Record<string, number>,
  localeSlug?: string,
  officeholders?: OfficeholderEntry[]
): string {
  const topicLines = Object.entries(topicDistribution)
    .map(([slug, count]) => `  - ${slug}: ${count} questions`)
    .join('\n');

  return `You are a civic education content creator generating trivia questions for ${localeName}.
Your goal is to create engaging, accurate, and fair civic trivia questions in the style of a TV game show — fun and energetic, not dry or academic.

## Output Format

Return ONLY valid JSON — no markdown code blocks, no explanatory text before or after. The JSON must match this exact structure. The \`correctAnswer\` index below is an example value only — vary it across questions rather than placing the answer first every time:
{
  "questions": [
    {
      "externalId": "xxx-001",
      "text": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "According to [source name], ...",
      "difficulty": "easy",
      "topicCategory": "topic-slug",
      "source": {
        "name": "Source Name",
        "url": "https://example.gov/page"
      },
      "expiresAt": null
    }
  ]
}

## Topic Distribution

Generate questions according to this distribution:
${topicLines}

## Difficulty Distribution

Distribute difficulty across the full batch:
- Easy: 40% of questions (foundational facts, direct answers)
- Medium: 40% of questions (requires some civic knowledge)
- Hard: 20% of questions (nuanced details, specific facts)

## Content Rules

### Tone and Style
- Match the energy and format of federal civics game show questions
- Write for a general adult audience at an 8th-grade reading level
- Questions should be engaging and surprising — not dry bureaucratic facts
- Each question must stand completely alone — no references to other questions

### Answer Options
- ALL four options must be plausible local alternatives — no obviously wrong throwaway answers
- Distractors should be real local entities, real neighboring towns, real government structures, real numbers in the right ballpark
- A civic-minded local resident should need to actually think before answering

### Explanations
- Every explanation MUST begin with: "According to [source name], ..."
- Cite the specific authoritative source you used for that fact
- Example: "According to bloomington.in.gov, the city council has 9 members."
- Explanations should be 1-3 sentences that teach the fact, not just restate it

### Source Requirements
- Every question MUST have a real, verifiable source URL
- Prefer: .gov > .us > .edu > established local media (.com)
- Source URLs must be actual pages where the fact can be verified
- Do not fabricate URLs

### Partisan Neutrality
- STRICTLY avoid all partisan content
- No political parties (Democrat, Republican, etc.) unless the fact is about party structure itself
- No characterization of policies as liberal, conservative, progressive, or any political label
- No controversial votes or divisive political issues
- Stick to structural facts: how government works, who holds office, what departments do, what laws say

### Elected Official Questions
- Questions about current elected officials are encouraged — they showcase the expiration system
- For these questions, set "expiresAt" to the ISO 8601 datetime of the official's term end date
- Example: If a mayor's term ends January 1, 2028: "expiresAt": "2028-01-01T00:00:00Z"
- For all other questions, set "expiresAt": null

### Facts Must Be Accurate
- Use only facts from the source documents provided
- If you are not certain of a fact, do not include it
- Numbers must be precise (budget figures, district counts, population stats)
- For time-sensitive facts (current officeholders, recent stats), set expiresAt — do NOT include the year in the question text. Write "Who is the current Mayor?" not "As of 2026, who is the Mayor?" Year-stamping the question text causes it to age badly.

## What to Avoid
- Vague or subjective questions ("Which is most important?")
- Questions with multiple defensible correct answers
- Trivia about individual private citizens
- Questions requiring knowledge of other questions
- Phone numbers, street addresses, or contact information in answer options — these test memorization of contact details, not civic knowledge
- Anything that could embarrass or politically compromise the civic education mission

${QUALITY_GUIDELINES}${localeSlug === 'fremont-ca' ? buildFremontSensitivityInstructions() : ''}${localeSlug === 'norwich-uk' ? buildNorwichVoiceGuidance() : ''}${localeSlug === 'cambridge-ma' ? buildCambridgeVoiceGuidance() : ''}${localeSlug === 'plano-tx' ? buildPlanoVoiceGuidance() : ''}${localeSlug === 'portland-or' ? buildPortlandVoiceGuidance() : ''}${localeSlug === 'washington-dc' ? buildWashingtonDcVoiceGuidance() : ''}${officeholders && officeholders.length > 0 ? buildOfficeholderBlock(officeholders) : ''}`;
}

/**
 * Builds Norwich, England voice and accuracy guidance for content generation.
 * Ensures UK civic terminology, correct two-tier government attribution, and
 * authentic local voice — written by and for the people of Norwich.
 */
function buildNorwichVoiceGuidance(): string {
  return `

## Norwich-Specific Content Guidelines

### Voice and Perspective
This question is written by and for the people of Norwich, England.
Write as a knowledgeable local, not as an outside observer.
The tone should feel like it comes from a proud Norfolk resident -- direct, unpretentious, and civic-minded.

### Required Terminology (use these, not American equivalents)
- "councillor" (not "council member")
- "ward" (not "district" or "precinct")
- "by-election" (not "special election")
- "MP" or "Member of Parliament" (not "congressman" or "representative")
- "parish council" (not "town board")
- "constituency" (not "district")
- "postcode" (not "zip code")
- "unitary authority" (when discussing local government reorganisation)
- "devolution" (when discussing power transferred from central government)

### Forbidden Terms (never use)
mayor, city hall (use "Norwich City Council" or "Guildhall"), zip code, congressman, senator, precinct, special election, alderman

### Two-Tier Government (critical accuracy requirement)
Norwich operates under a two-tier local government system:
- NORWICH CITY COUNCIL is responsible for: housing, planning, leisure, bin collections, council tax billing, environmental health
- NORFOLK COUNTY COUNCIL is responsible for: roads, schools, education, social care, libraries, public health, fire service

When writing a question about local services or governance, ensure the responsible authority matches the actual responsibility. Do NOT attribute county responsibilities to the city council or vice versa.

### Norwich City Council Lord Mayor
Norwich has a Lord Mayor (ceremonial role), not an elected mayor. Do not confuse with executive mayors in other cities.`;
}

/**
 * Builds Cambridge, MA voice and accuracy guidance for content generation.
 * Ensures Plan E government structure, PR voting history, and accurate civic facts
 * are represented correctly — with special attention to common misconceptions.
 */
function buildCambridgeVoiceGuidance(): string {
  return `

## Cambridge, MA — Specific Content Guidelines

### Government Structure (CRITICAL accuracy requirement)

Cambridge uses the **Plan E** City Manager form of government. The key distinction from most US cities:

- **City Manager** (currently Yi-An Huang) = CHIEF EXECUTIVE. Appointed by City Council. Runs all city departments, implements policy, manages the budget. This is NOT an elected position.
- **Mayor** = PRESIDING OFFICER of City Council. Elected by fellow City Councillors from among themselves, not directly by voters. The Mayor chairs Council meetings but does NOT have executive powers like a typical US mayor.
- **City Council** = 9 members, ALL elected at-large (no districts). Voters can rank all candidates. Two-year terms. Elections in odd-numbered years (November).

Questions about Cambridge leadership MUST reflect this distinction:
- CORRECT: "In Cambridge's Plan E charter, who is the chief executive responsible for running city departments?"
  → Answer: The City Manager
- WRONG: Any question implying the Mayor has executive powers over city departments

### Proportional Representation / Ranked-Choice Voting

Cambridge has used proportional representation (PR) since 1941, following voter approval of Plan E in 1940.

Key facts for accurate questions:
- Cambridge voters REJECTED Plan E in November 1938 (margin: 1,767 votes)
- Cambridge voters APPROVED Plan E in 1940 (margin: 7,552 votes)
- First PR election: 1941; first Plan E government took office: January 1942
- The system is PR (proportional representation) — a form of ranked-choice voting
- Any group with more than 1/10th of votes cast can elect at least one of the nine council members
- Five referenda to repeal PR (1952, 1953, 1957, 1961, 1965) — PR survived all five

Do NOT describe Plan E as Cambridge "abolishing" PR in 1938 — PR did not exist in Cambridge before 1938. The 1938 vote rejected introducing it.

### Living Wage Ordinance — Accurate Framing

Cambridge passed a living wage ordinance in **May 1999** (not 1998).

DO NOT frame this as Cambridge being the "first US city" — Baltimore passed the first US living wage ordinance in 1994. Cambridge's ordinance is still a significant civic fact worth covering; frame it accurately:
- CORRECT: "Cambridge passed its living wage ordinance in what year?" → Answer: 1999
- WRONG: "Cambridge became the first US city to pass a living wage ordinance in ____" → This is factually incorrect

### Harvard and MIT — Strict Limitation

This collection is NOT about Harvard or MIT.
- Do NOT write questions where Harvard or MIT is the primary civic subject
- Their civic/non-profit relationships to Cambridge city government MAY appear incidentally (e.g., PILOT payments, zoning agreements) but must not anchor a question
- Any question where removing the university name makes it meaningless is NOT a valid Cambridge civic question

### "Feel Seen" Standard — Represent the Whole City

Cambridge has distinct communities beyond the university-adjacent population. Questions should reflect the whole city:
- East Cambridge: Working-class history, Portuguese/Azorean community (St. Anthony's Church, 1902), furniture factories, later Brazilian community
- Cambridgeport: Historical port community (designated port of delivery by Congress, 1805)
- North Cambridge: Haitian community (arrived 1970s+)
- Housing advocacy: Cambridge has a strong tenant and affordable housing movement
- Generate at least some questions that would resonate with long-time Cambridge families, not just university-associated residents

### Cambridge City Hall

Cambridge City Hall (795 Massachusetts Ave) is **Richardsonian Romanesque** style, built in 1888. It is NOT neoclassical. It features heavy stone construction with Romanesque arches, built with funds donated by local benefactor Frederick Hastings Rindge.

Do NOT describe it as neoclassical or as having classical columns.

### Cambridge Rindge and Latin School (CRLS)

CRLS is the city's only public high school, formed in 1977 by the merger of Rindge Technical School (founded 1888 as a national model vocational school) and Cambridge High and Latin School. It reflects the city's diverse demographics and civic values (Opportunity, Diversity, Respect). Questions about CRLS should focus on its civic role and history, not its notable alumni.

### Expiration Dates for Elected Officials

- City Council members (elected November 2025): expiresAt "2028-01-01T00:00:00Z"
- Mayor (elected by Council after November 2025 election): expiresAt "2028-01-01T00:00:00Z"
- City Manager (appointed, no fixed term): expiresAt null (or omit time-sensitive name questions; prefer structural questions about the City Manager role)
- For structural questions (e.g., "How are City Council members elected?"): expiresAt null

Per the CONTEXT.md, target roughly 50% expiring and 50% durable questions. Durable = structural/historical facts. Expiring = questions about specific current officeholders.

### Difficulty Calibration

Over-index on EASY questions — the Easy Steps design requires easy questions to let players get 2 correct before advancing.

EASY = facts a civic-minded Cambridge resident would know or could figure out from general knowledge
NEVER include questions whose answer is an address, phone number, or obscure budget line item.

Apply the dinner party test: "Is this a tidbit a civic-minded person would be proud to share?"
- PASS: "What form of government does Cambridge use, where voters rank all candidates for 9 council seats?"
- PASS: "In what year did Cambridge adopt its Plan E charter, introducing the city manager form of government?"
- FAIL: "What is the square footage of Cambridge City Hall?"`;
}

/**
 * Builds Plano, TX voice and accuracy guidance for content generation.
 * Ensures Council-Manager government structure, corporate civic framing,
 * and Balloon Capital of Texas history are represented correctly.
 */
function buildPlanoVoiceGuidance(): string {
  return `

## Plano, TX — Specific Content Guidelines

### Government Structure (CRITICAL accuracy requirement)

Plano uses the **Council-Manager** form of government:

- **City Manager** (currently Mark Israelson, appointed May 2019) = CHIEF EXECUTIVE. Appointed by City Council. Manages all city departments and day-to-day operations. NOT elected.
- **Mayor** (currently John B. Muns, assumed office May 10, 2021; second term through 2029) = DIRECTLY ELECTED. Presides over City Council. Has one vote on Council like all other members.
- **City Council** = Mayor + 7 council members, ALL elected at-large (no districts). Four-year staggered terms. Two-term limit. Elections in odd-numbered years. Eight council places total.

### Balloon Capital of Texas (key durable topic)

- Governor Bill Clements proclaimed Plano the "Balloon Capital of Texas" in **1980**
- First Plano Balloon Rally: 1980 (50 pilots, 5 balloon launches, no official spectator area)
- In 1981, renamed Plano Hot Air Balloon Festival, relocated to Bob Woodruff Park
- Now held annually each September at Oak Point Park and Nature Preserve
- This is a DURABLE TOPIC — not time-sensitive, highly shareable civic trivia

### Founding and Name Origin (durable history)

- Settled by Peters Colony settlers, 1840s
- Post office established 1852; name "Plano" (Spanish for "flat") suggested by Dr. Henry Dye
- Houston and Texas Central Railway connected Plano to Dallas in **1872** — key growth catalyst
- Officially incorporated **1873** — elected mayor and board of aldermen
- 1881 fire destroyed 52 buildings, temporarily reduced to tent city — recovery by 1888

### Growth Story Calibration

- 1970 population: 17,872
- 1980 population: 72,000+ (more than quadrupled in one decade)
- 1990 population: 128,713 (72 square miles)
- Growth driven by Dallas expansion, Sun Belt migration, infrastructure investment
- City planners "kept up" with sewers, schools, and streets due to flat geography and grid planning

### Corporate Civic Angle (STRICT framing rules)

Mention companies ONLY in civic context:

- Frito-Lay: moved HQ to Plano **1985** → civic significance = thousands of jobs, economic development anchor
- JCPenney: moved HQ from New York City to Plano **1992** → civic significance = one of first major corporate relocations, city becoming business hub
- Toyota: announced North American HQ move from Torrance, CA to Plano; broke ground **January 2015**, operational by 2017 → civic significance = $350 million investment, 100-acre campus, accelerated Legacy West development
- Legacy West: 240-acre mixed-use development triggered by JCPenney's 2011 land development RFP → civic significance = city-planned urban development, brought JP Morgan Chase, Liberty Mutual, FedEx Office

FORBIDDEN: Product names, stock prices, production targets, Elon Musk (not a Plano story), corporate financial performance

### Collin County vs. City of Plano (avoid attribution errors)

Collin County provides: elections/voter registration, courts, property tax billing, vehicle registration, county sheriff, county jail, District Attorney, unincorporated road maintenance.

City of Plano provides: city planning and zoning, fire-rescue, parks and recreation, utilities, library system, animal services, environmental health, building permits.

Do NOT attribute county responsibilities to the City of Plano or vice versa.

### Community Identity (inclusive framing)

Plano's Asian American and South Asian community is the largest Asian ethnic group in the city (31,363 Asian Indian residents per recent census data; total Asian population ~22% of city). Reference as civic facts where they arise naturally — do NOT isolate as a separate identity topic. Examples:
- Cultural organizations, civic participation patterns
- Demographic change as part of the growth story

Plano ISD: serves over 50,000 students, consistently among top-performing Texas districts. Civic role = the school district as an institution shaped Plano's growth story and is a source of civic pride. Focus on the district's civic role, not specific school programs.

### Expiration Dates for Elected Officials

- Mayor John B. Muns (re-elected May 3, 2025): expiresAt "2029-05-01T00:00:00Z"
- City Council members (four-year terms, staggered odd-year elections): set expiresAt based on which "Place" and their election year
  - Places 2, 4, 6, 8 on 2023 cycle → next election 2027: expiresAt "2027-06-01T00:00:00Z"
  - Places 1, 3, 5, 7 on 2025 cycle (including 2026 special election Place 7) → next election 2029: expiresAt "2029-06-01T00:00:00Z"
- City Manager (appointed, no fixed term): expiresAt null — prefer structural questions about the City Manager ROLE over current-officeholder name questions
- For structural questions (e.g., "What form of government does Plano use?"): expiresAt null

### Difficulty Calibration (Plano-specific)

Over-index on EASY questions — the Easy Steps design requires accessible entry points.

EASY: civic-minded person is proud to share the tidbit
- "What Texas designation did Governor Clements give Plano in 1980?" → Balloon Capital of Texas
- "What form of government does Plano use, where an appointed professional manages city operations?" → Council-Manager
- "In what year was Plano officially incorporated?" → 1873

NEVER ask for:
- Addresses or phone numbers
- Internal process details
- Obscure budget line items
- Questions where only a city employee would know the answer

Apply the dinner party test rigorously.
`;
}

/**
 * Builds Portland, OR voice and accuracy guidance for content generation.
 * Ensures the 2025 government restructuring, staggered term schedule,
 * and civic-first framing are represented correctly.
 */
function buildPortlandVoiceGuidance(): string {
  return `

## Portland, OR — Specific Content Guidelines

### Government Structure (CRITICAL accuracy requirement)

Portland restructured its government on January 1, 2025 — abolishing the commission form (adopted 1913, abolished by Measure 26-228 in November 2022) and replacing it with a mayor-council structure:

- **Mayor Keith Wilson** (took office January 2025, term expires January 2029): Executive branch only. Does NOT sit on City Council. Appoints the City Administrator. expiresAt: "2029-01-01T00:00:00Z"
- **City Administrator**: Appointed by Mayor. New role from the 2022 charter reform. Oversees day-to-day city operations. NOT directly elected.
- **City Council**: 12 members across 4 geographic districts (3 councilors per district). Members are called COUNCILORS, not commissioners.
- **City Auditor Simone Rede** (term expires January 2029): Independently elected. expiresAt: "2029-01-01T00:00:00Z"
- **Voting method**: Multi-winner ranked-choice voting. This is a significant civic achievement — Portland was the last major US city with a commission form when it voted to change.

NEVER use "commissioner" to describe current Portland City Council members. The correct term since January 1, 2025 is "councilor."

### Staggered Term Schedule (CRITICAL for expiresAt accuracy)

Portland City Council uses staggered 4-year and 2-year initial terms:

**Districts 1 & 2 — 4-year initial terms (expire January 2029):**
- District 1: Candace Avalos, Jamie Dunphy, Loretta Smith
- District 2: Sameer Kanal, Elana Pirtle-Guiney, Dan Ryan
- expiresAt for these councilors: "2029-01-01T00:00:00Z"

**Districts 3 & 4 — 2-year initial terms (expire January 2027, up for re-election November 2026):**
- District 3: Tiffany Koyama Lane, Angelita Morillo, Steve Novick
- District 4: Olivia Clark, Mitch Green, Eric Zimmerman
- expiresAt for these councilors: "2027-01-01T00:00:00Z"

When writing questions about specific councilors, use the correct expiresAt based on their district.

### Required Question Mix for City Government Topic

Generate BOTH types:
1. **Durable (expiresAt: null)**: How the new system works — number of districts, councilors per district, how ranked-choice voting works for council, what the City Administrator role is, how Portland's old commission form worked, when the change happened.
2. **Expiring**: Who is the current Mayor, who represents a specific district, who is the City Auditor.

Target: 25–30% of ALL questions should have expiresAt set.

### Portland City Proper vs. Metro Area (CRITICAL scope boundary)

Questions MUST be scoped to Portland city proper.

Portland city proper is NOT:
- Beaverton (separate city, Washington County)
- Gresham (separate city, Multnomah County)
- Lake Oswego, Tigard, Hillsboro, Tualatin — all separate cities

Do NOT write questions about the Portland metro area and attribute facts to "Portland." If in doubt, scope to the city government and institutions within Portland city limits.

### Forbidden Topics and Framing

- NO "Keep Portland Weird" angle, no references to Portland's quirky reputation
- NO sports teams (Portland Trail Blazers, Timbers, Thorns) — strict civic focus
- NO food culture (food carts, craft beer, coffee scene)
- NO neighborhood-specific questions (Pearl District, Alberta Arts District, etc.) unless there is citywide civic significance
- NO politically charged editorial framing — state facts neutrally

### Rose City Identity

"Rose City" is the appropriate civic hook for Portland identity questions.
- First "City of Roses" reference: 1888 (Episcopal Church convention)
- Portland Rose Festival: first held 1907
- International Rose Test Garden: established 1917, oldest continuously operating public rose test garden in the US, in Washington Park

### Expiration Summary for All Roles

| Role | expiresAt |
|------|-----------|
| Mayor Keith Wilson | "2029-01-01T00:00:00Z" |
| City Auditor Simone Rede | "2029-01-01T00:00:00Z" |
| District 1 & 2 councilors | "2029-01-01T00:00:00Z" |
| District 3 & 4 councilors | "2027-01-01T00:00:00Z" |
| Structural/historical facts | null |`;
}

/**
 * Builds Fremont-specific sensitivity instructions for content generation.
 * These guidelines ensure culturally appropriate and accurate representation.
 */
function buildFremontSensitivityInstructions(): string {
  return `

## Fremont-Specific Content Guidelines

### Ohlone / Indigenous History
- ALWAYS use present tense: "Ohlone people have lived here for thousands of years"
- NEVER purely past tense: "Ohlone people lived here before colonization"
- Acknowledge ongoing presence, not just historical existence
- Respectful framing without romanticization of mission system

### Afghan-American Community / Little Kabul
- Focus on CULTURAL HERITAGE: food, traditions, cultural institutions, contributions to Fremont
- Do NOT reduce to refugee/immigration narrative
- Celebrate how the Afghan-American community has shaped Fremont's identity
- No poverty tourism or tragedy framing

### Tesla / NUMMI
- CIVIC ANGLES ONLY: zoning decisions, environmental review, job numbers, tax revenue, factory reuse
- NUMMI history and Tesla acquisition are fine (economic impact on Fremont)
- Do NOT ask about Tesla products (cars, batteries, software)
- Do NOT ask about Elon Musk personally (wealth, views, social media)
- Do NOT ask about corporate strategy (production targets, stock price)

### Mission San Jose Disambiguation
- "Mission San Jose (historic mission)" = 1797 Spanish mission (Mission San Jose de Guadalupe)
- "Mission San Jose district" = modern neighborhood within Fremont
- NEVER use ambiguous "Mission San Jose" without a qualifier

### Five-Town Consolidation (1956)
- When mentioning consolidation, name ALL five towns: Centerville, Niles, Irvington, Mission San Jose, Warm Springs
- This is a core Fremont identity story — ensure accuracy

### Diversity and Demographics
- Celebrate diversity through institutions, events, and cultural contributions
- Do NOT use census-style statistics ("X% of Fremont is Y ethnicity")
- Do NOT rank communities against each other
- Focus on what makes Fremont unique

### Expiration Timestamps for Elected Officials
- Fremont Mayor: term ends January 2027. Set expiresAt: "2027-01-01T00:00:00Z"
- City Council Districts up in 2026: expiresAt: "2027-01-01T00:00:00Z"
- Alameda County Supervisor District 1: expiresAt: "2027-01-01T00:00:00Z"
- For structural questions about offices (not specific people): expiresAt: null
- Prefer structural questions over current-official-name questions to reduce expiration churn

### Difficulty Distribution (Fremont-specific calibration)
- Target: 40% easy, 40% medium, 20% hard
- Easy: Foundational facts a civic-minded resident would know (e.g., "How many districts does Fremont have?")
- Medium: Requires civic knowledge but learnable (e.g., "What role does the city manager play?")
- Hard: Nuanced details even locals might not know (e.g., "Which five towns consolidated to form Fremont in 1956?")
- Distractors should scale with difficulty — easy has obviously wrong answers, hard has genuinely tricky ones`;
}

/**
 * Builds Washington, DC voice and accuracy guidance for content generation.
 * Ensures district framing, federal/local separation, and content scope restrictions
 * learned from Phase 60 curation are applied to all future generation runs.
 */
function buildWashingtonDcVoiceGuidance(): string {
  return `

## Washington, DC — Specific Content Guidelines

### District Framing (NON-NEGOTIABLE)

DC is NOT a city or a state. Always use district framing:
- CORRECT: "the District," "Washington, DC," "DC government," "DC Council"
- WRONG: "the city," "city council," "city government," "the state"

Every question must pass this check: does it use correct DC framing? If it calls DC a "city" in any sense that implies municipal = city, reject it.

### Federal vs. Local — Hard Boundary

DC content ONLY. Federal government content belongs in the Federal collection.

**FORBIDDEN topics (federal — do not generate):**
- US Congress, US Senate, US House of Representatives
- US Supreme Court (federal court — not a DC local institution)
- The White House, the President acting in federal capacity
- National monuments: Lincoln Memorial, Washington Monument, Jefferson Memorial, WWII Memorial
- Smithsonian museums, National Mall, National Park Service sites
- The US Capitol building as a DC civic landmark

**The Wilson Building vs. the Capitol:** The John A. Wilson Building (1350 Pennsylvania Ave NW) is DC's seat of local government. The US Capitol is a federal building. Never confuse the two. DC civic questions use the Wilson Building; federal questions use the Capitol.

### License Plates — FORBIDDEN

Do NOT generate questions about DC's license plate design, motto, or history. "Taxation Without Representation" is common knowledge that doesn't test civic understanding. License plate questions are not civic questions.

### Advisory Neighborhood Commissions (ANCs) — FORBIDDEN

Do NOT generate questions that focus on ANCs, specific ANC numbers (ANC 1A, 2B, etc.), or individual ANC commissioners. ANCs are too granular for a general civic audience. ANCs may appear incidentally as context (e.g., "DC created ANCs under the Home Rule Charter to give residents a voice in local decisions") but must never be the primary subject of a question.

### Courts & Judiciary — Structure Only, No Judge Names

DC court questions MUST focus on structure, not individuals:
- GOOD: "How many judges serve on the DC Court of Appeals?" or "Who appoints DC's local judges?"
- BAD: Questions naming specific judges, specific cases, specific appointments by name

The one critical fact worth testing: ALL DC local judges are appointed by the President and confirmed by the Senate (NOT elected, NOT appointed by the Mayor). This presidential-appointment fact is what distinguishes DC courts from every other jurisdiction and is the only reason this topic warrants questions.

### No Year-Stamped Questions

Do NOT write questions like "As of 2026, who is the Mayor of DC?" — the year makes the question feel dated immediately.
Instead: "Who is the current Mayor of Washington, DC?" with expiresAt set to 2027-01-02T00:00:00Z.
Use "currently" or "Who is the current X?" phrasing, never the year in the question text.

### Expiration Dates for DC Officeholders

- Mayor Muriel Bowser (not running for 4th term): expiresAt "2027-01-02T00:00:00Z"
- Council Chair Phil Mendelson: expiresAt "2027-01-02T00:00:00Z"
- Attorney General Brian Schwalb: expiresAt "2027-01-02T00:00:00Z"
- Non-voting Delegate Eleanor Holmes Norton (retiring 2026): expiresAt "2027-01-03T00:00:00Z"
- For structural questions (council composition, Home Rule Charter facts, court structure): expiresAt null

Target: 15–30% of questions should have expiresAt set.

### Rich Topic Areas to Draw From

Given the forbidden topics above, focus on these for content density:
- **Home Rule Charter**: Congress enacted December 24, 1973; DC voters approved May 1974 (4-to-1); 103 years without elected local government (1871–1974); Congressional 30-day review authority over DC laws
- **DC Council composition**: 13 members — 1 Chair elected at-large + 4 at-large members + 8 ward members, 4-year terms, no term limits
- **Ward system**: 8 wards, each with one Council member; quadrant system (NW/NE/SE/SW) radiates from the Capitol
- **23rd Amendment (1961)**: DC gets electoral votes equal to the least-populous state (3); first presidential vote 1964
- **DC history**: L'Enfant plan (1791), capital moved from Philadelphia in 1800, Virginia retrocession (1846), Marion Barry (4-term Mayor), Sharon Pratt (first Black woman elected Mayor of a major US city, 1991)
- **Constitutional status**: Article I Section 8 Clause 17 (District Clause); no voting representation in Congress; DC Voting Rights Amendment (1978, expired 1985 unratified); DC statehood movement (proposed name: Washington, Douglass Commonwealth)
- **DC Attorney General**: ELECTED since 2015 (previously appointed by Mayor) — this is a distinguishing fact worth testing
- **DC population**: ~700,000 — larger than Wyoming and Vermont, but no Senate representation

### Difficulty Calibration

Apply the dinner party test: "Is this a tidbit a civically-minded person would be proud to know?"
- PASS: "Who appoints DC's local judges — the Mayor, the President, or the DC Council?"
- PASS: "What constitutional amendment gave DC residents the right to vote for president?"
- FAIL: Specific ANC meeting procedures, individual judge names, license plate design history`;
}
