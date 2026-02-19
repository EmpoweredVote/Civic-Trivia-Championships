/**
 * Bloomington IN topic categories for civic trivia question generation.
 *
 * These topics were created in the database by the locale question generator
 * (src/scripts/content-generation/generate-locale-questions.ts --locale bloomington-in).
 *
 * Topics are linked to the 'bloomington-in' collection (ID: 2).
 * Reference: Phase 17, Plan 02 — Community Content Generation.
 *
 * To recreate: run the generation script with --locale bloomington-in
 * (ensureLocaleTopics runs automatically on each batch)
 */

export const bloomingtonTopics = [
  {
    slug: 'city-government',
    name: 'City Government',
    description: 'Bloomington city government — mayor, city council, departments, and municipal services',
  },
  {
    slug: 'monroe-county',
    name: 'Monroe County',
    description: 'Monroe County government — commissioners, county services, and county-level civics',
  },
  {
    slug: 'indiana-state',
    name: 'Indiana State Government',
    description: 'Indiana state government — governor, general assembly, and state agencies',
  },
  {
    slug: 'civic-history',
    name: 'Civic History',
    description: "Bloomington founding, key civic events, IU's civic role, and historical milestones",
  },
  {
    slug: 'local-services',
    name: 'Local Services',
    description: 'City utilities, parks and recreation, public safety, and municipal services',
  },
  {
    slug: 'elections-voting',
    name: 'Elections & Voting',
    description: 'Local election process, voting districts, and civic participation in Bloomington',
  },
  {
    slug: 'landmarks-culture',
    name: 'Landmarks & Culture',
    description: 'Cultural institutions, notable places, and what makes Bloomington unique',
  },
  {
    slug: 'budget-finance',
    name: 'Budget & Finance',
    description: 'City budget, tax structure, and how Bloomington funds public services',
  },
] as const;

/**
 * Generation run results (2026-02-19):
 *   - Total questions seeded: 100 (bli-001 through bli-100)
 *   - Status: draft (awaiting admin review and activation)
 *   - Collection: bloomington-in (ID: 2)
 *   - Topics: 8 categories (IDs 31-38)
 *   - Difficulty: 30 easy (30%), 44 medium (44%), 26 hard (26%)
 *   - Questions with expires_at: 7 (elected official questions)
 *   - Source documents: 12 .gov/.edu authoritative files
 *
 * Topic distribution:
 *   city-government: 13 questions
 *   monroe-county: 12 questions
 *   indiana-state: 14 questions
 *   civic-history: 11 questions
 *   local-services: 15 questions
 *   elections-voting: 10 questions
 *   landmarks-culture: 14 questions
 *   budget-finance: 11 questions
 */
