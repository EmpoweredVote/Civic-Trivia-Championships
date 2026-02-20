/**
 * Indiana state configuration for civic trivia question generation.
 * Used by generate-state-questions.ts to produce the Indiana state collection.
 */

import type { LocaleConfig } from '../bloomington-in.js';

export const indianaConfig: LocaleConfig = {
  locale: 'indiana-state',
  name: 'Indiana',
  externalIdPrefix: 'ins',
  collectionSlug: 'indiana-state',
  targetQuestions: 100,
  batchSize: 25,

  topicCategories: [
    // Government Structure (40%)
    {
      slug: 'legislature',
      name: 'State Legislature',
      description: 'Indiana General Assembly — composition, powers, and legislative processes',
    },
    {
      slug: 'governor-executive',
      name: 'Governor & Executive Branch',
      description: 'Governor, lieutenant governor, and executive agencies',
    },
    {
      slug: 'state-courts',
      name: 'State Courts & Judiciary',
      description: 'Indiana court system, judiciary selection, and judicial powers',
    },

    // Civic Processes (30%)
    {
      slug: 'elections-voting',
      name: 'Elections & Voting',
      description: 'State election procedures, voting rights, and election administration',
    },
    {
      slug: 'ballot-initiatives',
      name: 'Ballot Measures & Civic Participation',
      description: 'Constitutional amendment process, referendums, and direct citizen engagement',
    },

    // Broader Civics (30%)
    {
      slug: 'civic-history',
      name: 'Indiana Civic History',
      description: 'Statehood, founding, constitutional conventions, and civic milestones',
    },
    {
      slug: 'state-constitution',
      name: 'Indiana Constitution',
      description: 'State constitution provisions, amendments, and relationship to U.S. Constitution',
    },
    {
      slug: 'policy-civics',
      name: 'Policy & Governance',
      description: 'State policy areas, budget processes, taxation, education governance with civic context',
    },
  ],

  // Target question counts per topic (~100 total, roughly following 40/30/30 distribution)
  topicDistribution: {
    // Government Structure (40 questions)
    'legislature': 15,
    'governor-executive': 12,
    'state-courts': 13,

    // Civic Processes (30 questions)
    'elections-voting': 15,
    'ballot-initiatives': 10,

    // Broader Civics (30 questions)
    'civic-history': 12,
    'state-constitution': 12,
    'policy-civics': 11,
  },

  // Authoritative source URLs for RAG
  sourceUrls: [
    // Indiana state government
    'https://www.in.gov',
    'https://www.in.gov/gov',

    // Indiana General Assembly
    'https://iga.in.gov',
    'https://iga.in.gov/legislative/2024/legislators',

    // State courts
    'https://www.in.gov/courts',

    // Elections and Secretary of State
    'https://www.in.gov/sos',
    'https://www.in.gov/sos/elections',

    // State agencies
    'https://www.in.gov/core',

    // Civics and education resources
    'https://www.in.gov/sos/civics',
  ],
};

/**
 * Indiana-specific features to inject into state system prompt
 */
export const indianaStateFeatures = `
Indiana has several distinctive features in its state government:

**Legislative Structure:**
- Part-time legislature: The General Assembly meets for 61 days in odd-numbered years and 30 days in even-numbered years
- Bicameral: 50 senators (4-year terms) and 100 representatives (2-year terms)
- Citizen legislature model — legislators have other careers

**Executive Branch:**
- Multiple elected statewide officers: Governor, Lieutenant Governor, Attorney General, Secretary of State, Treasurer, and Auditor
- Governor serves 4-year terms with a term limit (can serve up to 8 years total)

**Civic Participation:**
- Indiana has referendum provisions for constitutional amendments (2 consecutive General Assembly sessions plus voter approval)
- No initiative process — constitutional amendments require legislative action
- Strong township government structure unique among states

**Statehood:**
- 19th state admitted to the Union (December 11, 1816)
- State motto: "The Crossroads of America"
`;
