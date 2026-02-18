import type { NewTopic } from '../schema.js';

// Primary topics (from questions.json "topic" field - normalized to title case)
export const topicsData: NewTopic[] = [
  // Primary topics - the 7 main categories
  {
    name: 'Constitution',
    slug: 'constitution',
    description: 'The U.S. Constitution and its foundational principles'
  },
  {
    name: 'Amendments',
    slug: 'amendments',
    description: 'Constitutional amendments and the Bill of Rights'
  },
  {
    name: 'Branches of Government',
    slug: 'branches-of-government',
    description: 'The three branches of federal government'
  },
  {
    name: 'Elections',
    slug: 'elections',
    description: 'Voting, elections, and the electoral process'
  },
  {
    name: 'Civic Participation',
    slug: 'civic-participation',
    description: 'How citizens engage with government'
  },
  {
    name: 'Supreme Court',
    slug: 'supreme-court',
    description: 'The Supreme Court and landmark decisions'
  },
  {
    name: 'U.S. History',
    slug: 'us-history',
    description: 'Historical events that shaped American government'
  },

  // Subcategory topics (from topicCategory values - stored as separate topics)
  {
    name: 'Bill of Rights',
    slug: 'bill-of-rights',
    description: 'The first ten amendments'
  },
  {
    name: 'Federalism',
    slug: 'federalism',
    description: 'Division of power between federal and state governments'
  },
  {
    name: 'Voting',
    slug: 'voting',
    description: 'Voting rights and voter participation'
  },
  {
    name: 'Congress',
    slug: 'congress',
    description: 'The legislative branch - House and Senate'
  },
  {
    name: 'Judiciary',
    slug: 'judiciary',
    description: 'The federal court system'
  },
  {
    name: 'Civic Participation (subcategory)',
    slug: 'civic-participation-sub',
    description: 'Forms of civic engagement beyond voting'
  },
  {
    name: 'Executive',
    slug: 'executive',
    description: 'The presidency and executive branch agencies'
  },
  {
    name: 'Elections (subcategory)',
    slug: 'elections-sub',
    description: 'Election processes and campaigns'
  }
];

// Mapping from JSON topic strings to topic slugs
// Handles both title case and lowercase variants
export const topicToSlugMap: Record<string, string> = {
  'Constitution': 'constitution',
  'constitution': 'constitution',
  'Amendments': 'amendments',
  'amendments': 'amendments',
  'Branches of Government': 'branches-of-government',
  'Elections': 'elections',
  'elections': 'elections',
  'Civic Participation': 'civic-participation',
  'civic-participation': 'civic-participation',
  'Supreme Court': 'supreme-court',
  'U.S. History': 'us-history',
  'bill-of-rights': 'bill-of-rights',
  'federalism': 'federalism',
  'voting': 'voting',
  'congress': 'congress',
  'judiciary': 'judiciary',
  'executive': 'executive'
};

// Mapping from topicCategory strings to topic slugs
export const topicCategoryToSlugMap: Record<string, string> = {
  'amendments': 'amendments',
  'bill-of-rights': 'bill-of-rights',
  'civic-participation': 'civic-participation-sub',
  'congress': 'congress',
  'elections': 'elections-sub',
  'executive': 'executive',
  'federalism': 'federalism',
  'judiciary': 'judiciary',
  'voting': 'voting'
};
