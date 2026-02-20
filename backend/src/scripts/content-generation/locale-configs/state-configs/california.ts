/**
 * California state configuration for civic trivia question generation.
 * Used by generate-state-questions.ts to produce the California state collection.
 */

import type { LocaleConfig } from '../bloomington-in.js';

export const californiaConfig: LocaleConfig = {
  locale: 'california-state',
  name: 'California',
  externalIdPrefix: 'cas',
  collectionSlug: 'california-state',
  targetQuestions: 100,
  batchSize: 25,

  topicCategories: [
    // Government Structure (40%)
    {
      slug: 'legislature',
      name: 'State Legislature',
      description: 'California State Legislature — Senate and Assembly composition, powers, and processes',
    },
    {
      slug: 'governor-executive',
      name: 'Governor & Executive Branch',
      description: 'Governor, constitutional officers, and executive departments',
    },
    {
      slug: 'state-courts',
      name: 'State Courts & Judiciary',
      description: 'California court system, judiciary selection, and judicial review',
    },

    // Civic Processes (30%)
    {
      slug: 'elections-voting',
      name: 'Elections & Voting',
      description: 'State election procedures, voting rights, and election administration',
    },
    {
      slug: 'ballot-initiatives',
      name: 'Ballot Propositions & Direct Democracy',
      description: 'Initiative, referendum, and recall processes — California\'s direct democracy mechanisms',
    },

    // Broader Civics (30%)
    {
      slug: 'civic-history',
      name: 'California Civic History',
      description: 'Statehood, constitutional conventions, civic movements, and historical milestones',
    },
    {
      slug: 'state-constitution',
      name: 'California Constitution',
      description: 'State constitution provisions, amendments, and relationship to U.S. Constitution',
    },
    {
      slug: 'policy-civics',
      name: 'Policy & Governance',
      description: 'State policy areas, budget processes, taxation, local government with civic context',
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
    // California state government
    'https://www.ca.gov',
    'https://www.gov.ca.gov',

    // California State Legislature
    'https://www.legislature.ca.gov',
    'https://www.legislature.ca.gov/legislators-and-districts',

    // State courts
    'https://www.courts.ca.gov',

    // Elections and Secretary of State
    'https://www.sos.ca.gov',
    'https://www.sos.ca.gov/elections',

    // Ballot propositions
    'https://www.sos.ca.gov/elections/ballot-measures',

    // State agencies
    'https://www.ca.gov/agencies',

    // California civics education
    'https://www.sos.ca.gov/elections/voter-registration',
  ],
};

/**
 * California-specific features to inject into state system prompt
 */
export const californiaStateFeatures = `
California has several distinctive features in its state government:

**Direct Democracy:**
- Strong ballot proposition system: Citizens can propose statutes (5% of last governor vote signatures) or constitutional amendments (8% signatures)
- Initiative, referendum, and recall — all three forms of direct democracy are actively used
- Constitutional amendments require two-thirds vote of each house OR citizen initiative

**Legislative Structure:**
- Full-time professional legislature: One of the largest state legislatures in the nation
- Bicameral: 40 senators (4-year terms) and 80 Assembly members (2-year terms)
- Two-thirds vote required to pass constitutional amendments (27 in Senate, 54 in Assembly)
- Term limits: Legislators can serve 12 years total across both chambers

**Executive Branch:**
- Governor serves 4-year terms with term limits (maximum of 2 terms)
- Multiple elected constitutional officers: Governor, Lieutenant Governor, Attorney General, Secretary of State, Treasurer, Controller, Superintendent of Public Instruction, Insurance Commissioner

**Civic Participation:**
- Extensive use of ballot initiatives — citizens regularly shape state law directly
- Recall process has been used to remove governors (2003 recall of Governor Gray Davis)
- Strong tradition of citizen activism and direct democracy

**Statehood:**
- 31st state admitted to the Union (September 9, 1850)
- State motto: "Eureka" (I have found it)
`;
