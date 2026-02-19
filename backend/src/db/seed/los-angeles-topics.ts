/**
 * Los Angeles CA topic categories for civic trivia question generation.
 *
 * These topics were created in the database by the locale question generator
 * (src/scripts/content-generation/generate-locale-questions.ts --locale los-angeles-ca).
 *
 * Topics are linked to the 'los-angeles-ca' collection (ID: 3).
 * Reference: Phase 17, Plan 03 — Community Content Generation.
 *
 * To recreate: run the generation script with --locale los-angeles-ca
 * (ensureLocaleTopics runs automatically on each batch)
 */

export const losAngelesTopics = [
  {
    slug: 'city-government',
    name: 'City Government',
    description: 'LA city government — mayor, city council (15 districts), departments, and municipal structure',
  },
  {
    slug: 'la-county',
    name: 'LA County Government',
    description: 'Los Angeles County — board of supervisors, county services, and county-level civics',
  },
  {
    slug: 'california-state',
    name: 'California State Government',
    description: 'California state government — governor, legislature, and the ballot propositions system',
  },
  {
    slug: 'civic-history',
    name: 'Civic History',
    description: 'LA founding, incorporation, key civic events, growth, and historical milestones',
  },
  {
    slug: 'local-services',
    name: 'Local Services',
    description: 'LADWP, Metro transit, LAPD, LAFD, and essential city services',
  },
  {
    slug: 'elections-voting',
    name: 'Elections & Voting',
    description: 'Local election process, neighborhood councils, voting districts, and civic participation in LA',
  },
  {
    slug: 'landmarks-culture',
    name: 'Landmarks & Culture',
    description: 'Cultural institutions, notable public spaces, and what makes LA unique',
  },
  {
    slug: 'budget-finance',
    name: 'Budget & Finance',
    description: 'City budget, tax structure, and how LA funds public services',
  },
] as const;

/**
 * Generation run results (2026-02-19):
 *   - Total questions seeded: 100 (lac-001 through lac-100)
 *   - Status: draft (awaiting admin review and activation)
 *   - Collection: los-angeles-ca (ID: 3)
 *   - Topics: 8 categories
 *   - Difficulty: 19 easy (19%), 48 medium (48%), 33 hard (33%)
 *   - Questions with expires_at: 8 (elected official questions)
 *   - Source documents: 7 authoritative .gov files (7 fetched, 7 failed due to 403/timeout)
 *
 * Topic distribution:
 *   california-state: 19 questions
 *   landmarks-culture: 14 questions
 *   la-county: 13 questions
 *   local-services: 13 questions
 *   city-government: 12 questions
 *   elections-voting: 12 questions
 *   budget-finance: 11 questions
 *   civic-history: 6 questions
 */
