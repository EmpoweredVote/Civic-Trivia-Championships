/**
 * scaffold-collection.ts
 *
 * CLI that automates 3 manual steps when adding a new collection:
 *   1. Insert seed entry into backend/src/db/seed/collections.ts (includes tier field)
 *   2. Create locale config file in backend/src/scripts/content-generation/locale-configs/{slug}.ts
 *   3. Register locale in generate-locale-questions.ts (supportedLocales + configKeys)
 *
 * Tier data flows through the seed entry into the database — no TypeScript source
 * files need editing for tier mapping. The dedup system reads tier from the DB at runtime.
 *
 * Usage:
 *   cd backend
 *   npx tsx src/scripts/scaffold-collection.ts --name "Austin, TX" --slug austin-tx --prefix aut --theme "#7C3AED"
 *   npx tsx src/scripts/scaffold-collection.ts --help
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

// ─── State expansion map ──────────────────────────────────────────────────────

const STATE_ABBREVIATIONS: Record<string, string> = {
  al: 'Alabama',
  ak: 'Alaska',
  az: 'Arizona',
  ar: 'Arkansas',
  ca: 'California',
  co: 'Colorado',
  ct: 'Connecticut',
  de: 'Delaware',
  fl: 'Florida',
  ga: 'Georgia',
  hi: 'Hawaii',
  id: 'Idaho',
  il: 'Illinois',
  in: 'Indiana',
  ia: 'Iowa',
  ks: 'Kansas',
  ky: 'Kentucky',
  la: 'Louisiana',
  me: 'Maine',
  md: 'Maryland',
  ma: 'Massachusetts',
  mi: 'Michigan',
  mn: 'Minnesota',
  ms: 'Mississippi',
  mo: 'Missouri',
  mt: 'Montana',
  ne: 'Nebraska',
  nv: 'Nevada',
  nh: 'New Hampshire',
  nj: 'New Jersey',
  nm: 'New Mexico',
  ny: 'New York',
  nc: 'North Carolina',
  nd: 'North Dakota',
  oh: 'Ohio',
  ok: 'Oklahoma',
  or: 'Oregon',
  pa: 'Pennsylvania',
  ri: 'Rhode Island',
  sc: 'South Carolina',
  sd: 'South Dakota',
  tn: 'Tennessee',
  tx: 'Texas',
  ut: 'Utah',
  vt: 'Vermont',
  va: 'Virginia',
  wa: 'Washington',
  wv: 'West Virginia',
  wi: 'Wisconsin',
  wy: 'Wyoming',
  dc: 'Washington D.C.',
};

// ─── CLI argument parsing ─────────────────────────────────────────────────────

interface ParsedArgs {
  name: string | null;
  slug: string | null;
  prefix: string | null;
  theme: string | null;
  tier: string;
  sortOrder: number | null;
  localeCode: string;
  description: string | null;
  help: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    name: null,
    slug: null,
    prefix: null,
    theme: null,
    tier: 'city',
    sortOrder: null,
    localeCode: 'en-US',
    description: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      result.name = args[i + 1];
      i++;
    } else if (args[i] === '--slug' && args[i + 1]) {
      result.slug = args[i + 1];
      i++;
    } else if (args[i] === '--prefix' && args[i + 1]) {
      result.prefix = args[i + 1];
      i++;
    } else if (args[i] === '--theme' && args[i + 1]) {
      result.theme = args[i + 1];
      i++;
    } else if (args[i] === '--tier' && args[i + 1]) {
      result.tier = args[i + 1];
      i++;
    } else if (args[i] === '--sort-order' && args[i + 1]) {
      result.sortOrder = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--locale-code' && args[i + 1]) {
      result.localeCode = args[i + 1];
      i++;
    } else if (args[i] === '--description' && args[i + 1]) {
      result.description = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      result.help = true;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Usage: npx tsx src/scripts/scaffold-collection.ts [options]

Required:
  --name <string>        Display name (e.g. "Austin, TX")
  --slug <string>        URL slug (e.g. austin-tx)  [a-z0-9-]
  --prefix <string>      External ID prefix, 2–5 chars (e.g. austx)  [a-z]{2,5}
  --theme <hex>          Theme color as 6-digit hex (e.g. "#7C3AED")

Optional:
  --tier <type>          city | state | federal | international  (default: city)
  --sort-order <n>       Sort order integer (default: auto-detect max+1)
  --locale-code <code>   Locale code (default: en-US)
  --description <text>   Collection tagline shown on the card — REQUIRED for production
                         (a distinctive one-liner, e.g. "B-Town bragging rights are on the line!")
  --help, -h             Show this help message

Examples:
  npx tsx src/scripts/scaffold-collection.ts --name "Austin, TX" --slug austin-tx --prefix aut --theme "#7C3AED"
  npx tsx src/scripts/scaffold-collection.ts --name "Texas State" --slug texas-state --prefix txs --theme "#BF5700" --tier state
`);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(args: ParsedArgs): void {
  const errors: string[] = [];

  if (!args.name) errors.push('--name is required');
  if (!args.slug) errors.push('--slug is required');
  if (!args.prefix) errors.push('--prefix is required');
  if (!args.theme) errors.push('--theme is required');

  if (args.slug && !/^[a-z0-9-]+$/.test(args.slug)) {
    errors.push(`--slug "${args.slug}" must match /^[a-z0-9-]+$/`);
  }

  if (args.prefix && !/^[a-z]{2,5}$/.test(args.prefix)) {
    errors.push(`--prefix "${args.prefix}" must match /^[a-z]{2,5}$/ (2–5 lowercase letters)`);
  }

  if (args.theme && !/^#[0-9A-Fa-f]{6}$/.test(args.theme)) {
    errors.push(`--theme "${args.theme}" must be a 6-digit hex color like "#7C3AED"`);
  }

  const validTiers = ['city', 'state', 'federal', 'international'];
  if (!validTiers.includes(args.tier)) {
    errors.push(`--tier "${args.tier}" must be one of: city, state, federal, international`);
  }

  if (errors.length > 0) {
    console.error('Validation errors:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Escape a value for embedding inside a single-quoted TypeScript string literal.
 *
 * Every generated field below is written as '${value}'. Without escaping, an
 * apostrophe closes the literal early and emits a file that will not compile —
 * e.g. a "Coeur d'Alene, ID" name, or a tagline like
 * "prove you're a real Badger". Backslashes are escaped first so the quote
 * escapes we add are not themselves re-escaped, and newlines are folded because
 * a raw newline is illegal inside a single-quoted literal.
 */
function escapeSingleQuoted(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

/**
 * Derive localeName from display name.
 * For cities: expand state abbreviation if present (e.g. "Austin, TX" -> "Austin, Texas")
 * For state/federal tiers or names without comma: use name as-is.
 */
function deriveLocaleName(name: string, tier: string): string {
  if (tier !== 'city') return name;

  const commaIdx = name.indexOf(',');
  if (commaIdx === -1) return name;

  const city = name.slice(0, commaIdx).trim();
  const stateAbbr = name.slice(commaIdx + 1).trim();
  const expanded = STATE_ABBREVIATIONS[stateAbbr.toLowerCase()];

  if (expanded) {
    return `${city}, ${expanded}`;
  }

  return name;
}

/**
 * Derive iconIdentifier from slug and tier.
 * - city: flag-{suffix} where suffix is the last hyphen-segment (e.g. austin-tx -> flag-tx)
 * - state: "state"
 * - federal: "flag-us"
 */
function deriveIconIdentifier(slug: string, tier: string): string {
  if (tier === 'federal') return 'flag-us';
  if (tier === 'state') return 'state';
  if (tier === 'international') return 'globe';

  // city: extract last segment after final hyphen
  const parts = slug.split('-');
  const suffix = parts[parts.length - 1];
  return `flag-${suffix}`;
}

/**
 * Derive camelCase config variable name from slug.
 * Takes text before first hyphen and camelCases the rest.
 * e.g. "austin-tx" -> "austinTx", "los-angeles-ca" -> "losAngelesCa"
 */
function deriveConfigVarName(slug: string): string {
  const parts = slug.split('-');
  if (parts.length === 1) return parts[0];
  return parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/**
 * Parse existing sort orders from collections.ts and return max + 1.
 */
function detectNextSortOrder(collectionsContent: string): number {
  const matches = collectionsContent.matchAll(/sortOrder:\s*(\d+)/g);
  let max = 0;
  for (const m of matches) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max + 1;
}

// ─── Step 1: Insert seed entry into collections.ts ────────────────────────────

function step1InsertSeedEntry(args: ParsedArgs, sortOrder: number, localeName: string, iconIdentifier: string, description: string): void {
  const filePath = resolve(process.cwd(), 'src/db/seed/collections.ts');
  const content = readFileSync(filePath, 'utf-8');

  // Find position of the final `];`
  const closingBracket = content.lastIndexOf('];');
  if (closingBracket === -1) {
    console.error('Error: Could not find closing `];` in collections.ts');
    process.exit(1);
  }

  const newEntry = `  {
    name: '${escapeSingleQuoted(args.name!)}',
    slug: '${args.slug}',
    description: '${escapeSingleQuoted(description)}',
    localeCode: '${escapeSingleQuoted(args.localeCode)}',
    localeName: '${escapeSingleQuoted(localeName)}',
    iconIdentifier: '${escapeSingleQuoted(iconIdentifier)}',
    themeColor: '${args.theme}',
    tier: '${args.tier}',
    isActive: false,
    sortOrder: ${sortOrder}
  },\n`;

  const updated = content.slice(0, closingBracket) + newEntry + content.slice(closingBracket);
  writeFileSync(filePath, updated, 'utf-8');
  console.log(`  - backend/src/db/seed/collections.ts (seed entry added, sortOrder: ${sortOrder})`);
}

// ─── Step 2: Create locale config file ───────────────────────────────────────

function step2CreateLocaleConfig(args: ParsedArgs, configVarName: string): string {
  const fileName = `${args.slug}.ts`;
  const dirPath = resolve(process.cwd(), 'src/scripts/content-generation/locale-configs');
  const filePath = join(dirPath, fileName);

  if (existsSync(filePath)) {
    console.error(`Error: Locale config already exists: ${filePath}`);
    console.error('Remove it first or choose a different slug.');
    process.exit(1);
  }

  const nameForTopics = escapeSingleQuoted(args.name!);

  const fileContent = `import type { LocaleConfig } from './bloomington-in.js';

export const ${configVarName}Config: LocaleConfig = {
  locale: '${args.slug}',
  name: '${escapeSingleQuoted(args.name!)}',
  externalIdPrefix: '${args.prefix}',
  collectionSlug: '${args.slug}',
  targetQuestions: 100,
  batchSize: 25,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description: '${nameForTopics} city government — mayor, city council, departments, and municipal services',
    },
    {
      slug: 'civic-history',
      name: 'Civic History',
      description: '${nameForTopics} founding, key civic events, and historical milestones',
    },
    {
      slug: 'local-services',
      name: 'Local Services',
      description: '${nameForTopics} utilities, parks and recreation, public safety, and municipal services',
    },
  ],

  // Target question counts per topic (sums to 100)
  topicDistribution: {
    'city-government': 40,
    'civic-history': 30,
    'local-services': 30,
  },

  // TODO: Add authoritative source URLs for RAG — fetched and parsed before generation
  sourceUrls: [],
};
`;

  writeFileSync(filePath, fileContent, 'utf-8');
  console.log(`  - backend/src/scripts/content-generation/locale-configs/${fileName} (created)`);

  return filePath;
}

// ─── Step 3: Register in generate-locale-questions.ts ─────────────────────────

function step3RegisterLocale(args: ParsedArgs, configVarName: string): void {
  const filePath = resolve(process.cwd(), 'src/scripts/content-generation/generate-locale-questions.ts');
  let content = readFileSync(filePath, 'utf-8');

  // Insert into supportedLocales object — find the object literal assignment, not the type annotation
  const supportedLocalesStart = content.indexOf('const supportedLocales:');
  if (supportedLocalesStart === -1) {
    console.error('Error: Could not find `const supportedLocales:` in generate-locale-questions.ts');
    process.exit(1);
  }

  // Skip past the TypeScript type annotation by finding ` = {` (the object literal assignment)
  // This avoids miscounting braces from the type annotation: `Record<string, () => Promise<{ ... }>>  = {`
  const assignmentPos = content.indexOf(' = {', supportedLocalesStart);
  if (assignmentPos === -1) {
    console.error('Error: Could not find ` = {` assignment for supportedLocales in generate-locale-questions.ts');
    process.exit(1);
  }

  // Scan brace depth starting from the opening `{` of the object literal
  const objectOpenPos = assignmentPos + 3; // position of `{`
  let braceDepth = 0;
  let objectClosePos = -1;

  for (let i = objectOpenPos; i < content.length; i++) {
    if (content[i] === '{') {
      braceDepth++;
    } else if (content[i] === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        objectClosePos = i;
        break;
      }
    }
  }

  if (objectClosePos === -1) {
    console.error('Error: Could not locate end of supportedLocales object');
    process.exit(1);
  }

  const localeEntry = `    '${args.slug}': () => import('./locale-configs/${args.slug}.js') as Promise<{ ${configVarName}Config: LocaleConfig }>,\n  `;

  content = content.slice(0, objectClosePos) + localeEntry + content.slice(objectClosePos);

  // Now insert into configKeys array
  // After the previous insertion the positions shifted, so re-read positions
  const configKeysStart = content.indexOf('const configKeys = [');
  if (configKeysStart === -1) {
    console.error('Error: Could not find `const configKeys = [` in generate-locale-questions.ts');
    process.exit(1);
  }

  // Find the closing `]` of the configKeys array
  let squareBraceDepth = 0;
  let arrayClosePos = -1;
  let inArray = false;

  for (let i = configKeysStart; i < content.length; i++) {
    if (content[i] === '[') {
      squareBraceDepth++;
      inArray = true;
    } else if (content[i] === ']' && inArray) {
      squareBraceDepth--;
      if (squareBraceDepth === 0) {
        arrayClosePos = i;
        break;
      }
    }
  }

  if (arrayClosePos === -1) {
    console.error('Error: Could not locate end of configKeys array');
    process.exit(1);
  }

  const configKeyEntry = `, '${configVarName}Config'`;
  content = content.slice(0, arrayClosePos) + configKeyEntry + content.slice(arrayClosePos);

  writeFileSync(filePath, content, 'utf-8');
  console.log(`  - backend/src/scripts/content-generation/generate-locale-questions.ts (locale registered)`);

  // Post-write sanity check — confirm both insertion sites landed correctly
  const written = readFileSync(filePath, 'utf-8');
  if (!written.includes(`'${args.slug}'`)) {
    console.error(`Error: Post-write check failed — slug '${args.slug}' not found in supportedLocales after write`);
    process.exit(1);
  }
  if (!written.includes(`${configVarName}Config`)) {
    console.error(`Error: Post-write check failed — '${configVarName}Config' not found in configKeys after write`);
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  validate(args);

  // Safe to assert non-null after validation
  const name = args.name!;
  const slug = args.slug!;
  const prefix = args.prefix!;

  // Read collections.ts to detect sort order
  const collectionsPath = resolve(process.cwd(), 'src/db/seed/collections.ts');
  if (!existsSync(collectionsPath)) {
    console.error(`Error: Could not find ${collectionsPath}`);
    console.error('Run this script from the backend/ directory.');
    process.exit(1);
  }

  const collectionsContent = readFileSync(collectionsPath, 'utf-8');
  const sortOrder = args.sortOrder ?? detectNextSortOrder(collectionsContent);

  const localeName = deriveLocaleName(name, args.tier);
  const iconIdentifier = deriveIconIdentifier(slug, args.tier);
  const configVarName = deriveConfigVarName(slug);
  const description = args.description ?? `Test your ${name} civic knowledge!`;
  if (!args.description) {
    console.warn(`\n⚠  No --description provided. Placeholder tagline will be used.`);
    console.warn(`   Replace it in collections.ts AND the database before activating.\n`);
  }

  console.log(`\nScaffolding collection: ${name} (${slug})`);
  console.log(`  Prefix: ${prefix}`);
  console.log(`  Tier: ${args.tier}`);
  console.log(`  Sort order: ${sortOrder}`);
  console.log(`  Theme: ${args.theme}`);
  console.log(`  Local name: ${localeName}`);
  console.log(`  Icon: ${iconIdentifier}`);
  console.log(`  Config var: ${configVarName}Config`);
  console.log('');
  console.log('Files modified:');

  step1InsertSeedEntry(args, sortOrder, localeName, iconIdentifier, description);
  const localeConfigPath = step2CreateLocaleConfig(args, configVarName);
  step3RegisterLocale(args, configVarName);

  console.log(`
Collection scaffolded successfully!

Files modified:
  - backend/src/db/seed/collections.ts (new seed entry with tier: '${args.tier}')
  - backend/src/scripts/content-generation/locale-configs/${slug}.ts (created)
  - backend/src/scripts/content-generation/generate-locale-questions.ts (locale registered)

Next steps:
  1. Edit locale config: ${localeConfigPath.replace(/\\/g, '/')}
     - Customize topic categories and source URLs
     - Add voice guidance (expiration dates, accuracy notes, what to avoid)
  2. Write a distinctive tagline and update it in collections.ts${args.description ? '' : '\n     ⚠  Currently using a generic placeholder — replace before activating!'}
     Style guide: rhetorical question or punchy one-liner using a local nickname or fact
     Examples: "B-Town bragging rights are on the line!"
               "Five towns, one city — how well do you know Fremont?"
               "Can the Bay State's oldest democracy stump you?"
  3. Seed the collection to DB (tier flows through the seed entry automatically):
     cd backend && npx tsx src/db/seed/seed.ts
  4. Generate questions:
     cd backend && npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale ${slug} --fetch-sources
  5. Add banner image:
     frontend/public/images/collections/${slug}.jpg${args.tier === 'state' ? '\n     ⚠  STATE COLLECTION: use a photo of the state capitol building.' : ''}
  6. Activate when ready:
     cd backend && npx tsx src/scripts/activate-collection.ts --slug ${slug} --prefix ${prefix}
`);
}

main();
