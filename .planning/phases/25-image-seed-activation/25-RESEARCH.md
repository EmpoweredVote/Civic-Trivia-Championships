# Phase 25: Image, Seed & Activation - Research

**Researched:** 2026-02-21
**Domain:** Static asset management, database seeding, collection activation
**Confidence:** HIGH

## Summary

Phase 25 activates the Fremont collection by adding a banner image, exporting question data to JSON, and enabling the collection in the database. This follows the established pattern used for Bloomington and Los Angeles collections.

The existing codebase already has all infrastructure in place: export-community.ts exports questions to JSON, seed-community.ts imports them idempotently, and CollectionCard.tsx displays banner images at `/images/collections/{slug}.jpg`. The phase requires three straightforward modifications: (1) add status filter to export script to exclude draft questions, (2) find and optimize a Mission Peak photo, and (3) add Fremont to the seed LOCALES array.

This is a low-risk, well-trodden path. The patterns are proven (used successfully for 2 existing community collections), the data is ready (92 active questions validated in Phase 24), and the infrastructure is stable (no new dependencies or architecture changes needed).

**Primary recommendation:** Modify export-community.ts to filter by status='active', find a vibrant Mission Peak photo from Unsplash or Wikimedia Commons, optimize to ~150-200KB JPEG, add Fremont to seed script, and activate collection.

## Standard Stack

The established tools for this domain are already in the codebase.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tsx | 4.7.0 | TypeScript execution | Project standard for all backend scripts |
| drizzle-orm | 0.45.1 | Database queries | Project ORM, supports idempotent seeding patterns |
| Node.js fs | built-in | File I/O | Standard for reading/writing JSON exports |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Sharp | Not installed | Image optimization | Optional for automated resizing/compression |
| Manual tools | N/A | Image editing | Acceptable for one-time banner preparation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sharp (automated) | Manual image tools (Photoshop, GIMP, online) | One-time task doesn't justify dependency. Manual is fine. |
| JPEG | WebP | JPEG already used for 5 existing banners. Consistency matters. |

**Installation:**
```bash
# No new dependencies required
# Optional if automated image processing desired:
npm install sharp --save-dev
```

## Architecture Patterns

### Existing Project Structure
```
backend/src/
├── data/                          # Static JSON data files
│   ├── bloomington-in-questions.json
│   ├── los-angeles-ca-questions.json
│   └── fremont-ca-questions.json  # NEW in Phase 25
├── db/seed/
│   ├── seed-community.ts          # MODIFY: add fremont-ca to LOCALES
│   └── collections.ts             # Already has Fremont (isActive: false)
└── scripts/
    └── export-community.ts        # MODIFY: add status filter

frontend/public/images/collections/
├── federal.jpg
├── bloomington-in.jpg
├── los-angeles-ca.jpg
└── fremont-ca.jpg                 # NEW in Phase 25
```

### Pattern 1: Status-Filtered Database Export
**What:** Export only active questions from database to JSON, excluding drafts/archived
**When to use:** All community collection exports (protects production from unvetted content)
**Example:**
```typescript
// Source: Existing export-community.ts pattern (line 88-102)
const linkedQuestions = await db
  .select({
    externalId: questions.externalId,
    text: questions.text,
    options: questions.options,
    correctAnswer: questions.correctAnswer,
    explanation: questions.explanation,
    difficulty: questions.difficulty,
    subcategory: questions.subcategory,
    source: questions.source,
    expiresAt: questions.expiresAt,
    status: questions.status,  // NEED TO ADD to select
  })
  .from(collectionQuestions)
  .innerJoin(questions, eq(collectionQuestions.questionId, questions.id))
  .where(
    and(
      eq(collectionQuestions.collectionId, collection.id),
      eq(questions.status, 'active')  // NEW FILTER
    )
  );
```

### Pattern 2: Idempotent Seeding with LOCALES Array
**What:** Central list of collections to seed, script runs safely multiple times
**When to use:** All database seeding operations
**Example:**
```typescript
// Source: backend/src/db/seed/seed-community.ts (line 53-56)
const LOCALES = [
  { slug: 'bloomington-in', file: 'bloomington-in-questions.json' },
  { slug: 'los-angeles-ca', file: 'los-angeles-ca-questions.json' },
  { slug: 'fremont-ca', file: 'fremont-ca-questions.json' },  // ADD THIS
];
```

Seed script uses `onConflictDoNothing()` throughout, making it safe to re-run. Activation happens automatically via:
```typescript
// Line 83-86 of seed-community.ts
await db
  .update(collections)
  .set({ isActive: true })
  .where(eq(collections.slug, slug));
```

### Pattern 3: Convention-Based Banner Image Loading
**What:** Frontend loads banner from `/images/collections/{slug}.jpg` with themeColor fallback
**When to use:** All collection cards
**Example:**
```typescript
// Source: frontend/src/features/collections/components/CollectionCard.tsx (line 26-37)
<div
  className="h-28 rounded-t-xl overflow-hidden"
  style={{ backgroundColor: collection.themeColor }}
>
  <img
    src={`/images/collections/${collection.slug}.jpg`}
    alt=""
    className="w-full h-full object-cover"
    loading="lazy"
  />
</div>
```

Height: `h-28` = 112px (7rem × 16px). Image uses `object-cover` to crop/center within container. Width is responsive (full card width ~192px on desktop, 100% on mobile).

### Anti-Patterns to Avoid
- **Exporting draft questions:** Status filter is CRITICAL. Draft questions not ready for production.
- **Inconsistent file naming:** Must be `{slug}.jpg` exactly. `fremont.jpg` won't work (slug is `fremont-ca`).
- **Oversized images:** Existing banners are 121-283KB. Don't upload multi-MB files that slow page load.
- **Non-JPEG formats:** CollectionCard expects `.jpg`. Using `.png` or `.webp` breaks convention and requires frontend changes.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resizing/optimization | Custom Node script | Sharp library OR manual tools | Sharp is battle-tested for Node.js image processing. Manual tools fine for one-time task. |
| Status filtering in exports | Manual array filtering | Drizzle WHERE clause | Database does filtering efficiently, ensures consistent logic with other queries. |
| JSON formatting | Custom stringification | `JSON.stringify(output, null, 2) + '\n'` | Existing pattern produces consistent 2-space indented JSON with trailing newline. |
| Idempotent seeding | Custom conflict handling | Drizzle `.onConflictDoNothing()` | Built-in conflict resolution, prevents duplicate key errors. |

**Key insight:** This codebase has mature patterns for collection activation. Follow them exactly rather than inventing variations.

## Common Pitfalls

### Pitfall 1: Forgetting Status Filter on Export
**What goes wrong:** Draft questions (31 in Fremont collection) get exported to production seed data
**Why it happens:** Existing export-community.ts doesn't filter by status (Bloomington/LA had no drafts when exported)
**How to avoid:** Add `eq(questions.status, 'active')` to WHERE clause using `and()` combinator
**Warning signs:** Export script reports 123 questions instead of 92

### Pitfall 2: Wrong Image Dimensions/Aspect Ratio
**What goes wrong:** Image looks stretched, pixelated, or crops poorly with `object-cover`
**Why it happens:** Mission Peak photos often portrait/square, banner needs landscape orientation
**How to avoid:** Test image locally before committing. Ideal source aspect ~16:9 or 2:1. `object-cover` crops to 112px height × responsive width.
**Warning signs:** Image looks distorted in browser, doesn't match aesthetic of other collection cards

### Pitfall 3: Image File Size Too Large
**What goes wrong:** Collection picker page loads slowly, especially on mobile
**Why it happens:** High-resolution source photos from cameras are 5-10MB
**How to avoid:** Check existing banner sizes (121-283KB). Optimize to similar range. 200KB is safe target.
**Warning signs:** Image file over 500KB, page load metrics degrade

### Pitfall 4: Activating Collection Without Image
**What goes wrong:** CollectionCard.tsx tries to load missing image, shows only themeColor background
**Why it happens:** Seed script runs before image is committed, or image filename doesn't match slug
**How to avoid:** Commit image FIRST, verify file exists at `frontend/public/images/collections/fremont-ca.jpg`, then run seed
**Warning signs:** Browser 404 errors for fremont-ca.jpg, card shows only emerald green background

### Pitfall 5: Not Re-Running Export After Adding Filter
**What goes wrong:** Existing Bloomington/LA exports have all questions (no status filter existed), inconsistent with new pattern
**Why it happens:** Adding status filter to export script doesn't retroactively update old JSON files
**How to avoid:** If perfectionism matters, re-export Bloomington/LA to ensure consistency. If not, document that filter added in Phase 25.
**Warning signs:** Code reviewer notices Bloomington export has 100 questions but no status filter in export logic

## Code Examples

Verified patterns from existing codebase:

### Export with Status Filter (NEW - to be added)
```typescript
// Modify backend/src/scripts/export-community.ts around line 88
import { eq, and } from 'drizzle-orm';

const linkedQuestions = await db
  .select({
    externalId: questions.externalId,
    text: questions.text,
    options: questions.options,
    correctAnswer: questions.correctAnswer,
    explanation: questions.explanation,
    difficulty: questions.difficulty,
    subcategory: questions.subcategory,
    source: questions.source,
    expiresAt: questions.expiresAt,
  })
  .from(collectionQuestions)
  .innerJoin(questions, eq(collectionQuestions.questionId, questions.id))
  .where(
    and(
      eq(collectionQuestions.collectionId, collection.id),
      eq(questions.status, 'active')  // Filter out draft/archived
    )
  );
```

### Add Fremont to Seed LOCALES
```typescript
// backend/src/db/seed/seed-community.ts line 53
const LOCALES = [
  { slug: 'bloomington-in', file: 'bloomington-in-questions.json' },
  { slug: 'los-angeles-ca', file: 'los-angeles-ca-questions.json' },
  { slug: 'fremont-ca', file: 'fremont-ca-questions.json' },
];
```

### Run Export and Seed
```bash
# 1. Export Fremont questions to JSON (92 active only)
npx tsx src/scripts/export-community.ts

# 2. Seed all community collections (idempotent)
npm run db:seed:community
```

### Manual Image Optimization (if using Sharp)
```typescript
// Optional script: backend/src/scripts/optimize-banner.ts
import sharp from 'sharp';

await sharp('source-mission-peak.jpg')
  .resize(800, 450, { fit: 'cover', position: 'center' })  // 16:9 landscape
  .jpeg({ quality: 85, progressive: true })
  .toFile('frontend/public/images/collections/fremont-ca.jpg');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual SQL exports | TypeScript export scripts | Phase 17 (community content) | Reproducible, version-controlled data export |
| Direct database activation | JSON seed files | Phase 17 | Staging environment support, easier rollback |
| All questions exported | Status-filtered exports | Phase 25 (this phase) | Protects production from draft content |

**Deprecated/outdated:**
- N/A - This is a new collection activation, not replacing deprecated patterns

**Current conventions established:**
- JPEG format for collection banners (5 existing)
- ~150-200KB target file size (range: 121-283KB observed)
- 112px height banner (h-28 Tailwind class)
- Convention-based loading (`{slug}.jpg`)
- Idempotent seeding with `onConflictDoNothing()`

## Open Questions

1. **Should existing Bloomington/LA exports be regenerated with status filter?**
   - What we know: They currently export all questions regardless of status
   - What's unclear: Whether consistency across all exports matters for future maintenance
   - Recommendation: Skip regeneration unless Bloomington/LA have draft questions. Current exports are fine, filter prevents future issues.

2. **Should Sharp be added as dependency for future collections?**
   - What we know: It's the standard Node.js image processing library, but manual tools work fine for one-off tasks
   - What's unclear: Whether 10+ more collections are planned (would justify automation)
   - Recommendation: Defer to Phase 26+ planning. Manual optimization sufficient for now.

3. **What about image attribution/licensing documentation?**
   - What we know: Creative Commons images often require attribution, existing banners have no visible attribution
   - What's unclear: Project's legal requirements for CC image attribution
   - Recommendation: Use CC0 (public domain) or Unsplash License images that don't require attribution. Document source URL in git commit message.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/src/scripts/export-community.ts` (lines 1-147)
- Existing codebase: `backend/src/db/seed/seed-community.ts` (lines 1-207)
- Existing codebase: `backend/src/db/schema.ts` (line 75 - status field definition)
- Existing codebase: `frontend/src/features/collections/components/CollectionCard.tsx` (lines 26-37)
- Existing pattern: 5 collection banner images in `frontend/public/images/collections/`

### Secondary (MEDIUM confidence)
- [Sharp - High performance Node.js image processing](https://sharp.pixelplumbing.com/) - Official documentation
- [Sharp GitHub Repository](https://github.com/lovell/sharp) - Library source and examples
- [Openverse - Openly Licensed Images](https://openverse.org/) - CC image search aggregator
- [Unsplash - Free Photos](https://unsplash.com/) - Free stock photos with permissive license
- [Wikimedia Commons - Free Media Resources](https://commons.wikimedia.org/wiki/Commons:Free_media_resources/Photography) - Public domain images
- [How to Optimize Website Images (Request Metrics)](https://requestmetrics.com/web-performance/high-performance-images/) - Image optimization guide
- [Website Banner Dimensions (ShortPixel)](https://shortpixel.com/blog/website-banner-dimensions/) - Banner best practices
- [Efficient Database Seeding in Node.js (Medium)](https://medium.com/@fanbubu0/efficient-database-seeding-in-node-js-a-step-by-step-guide-ba122cc71d49) - Seeding patterns

### Tertiary (LOW confidence)
- None - all findings verified against codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All patterns exist in codebase, no new dependencies required
- Architecture: HIGH - Established patterns used successfully for 2 existing community collections
- Pitfalls: HIGH - Derived from analysis of existing code and common web dev mistakes
- Image sourcing: MEDIUM - CC image sources well-documented, but specific Mission Peak photo requires discovery
- Image optimization: MEDIUM - Best practices well-established, but specific dimensions are project convention not universal standard

**Research date:** 2026-02-21
**Valid until:** 2026-05-21 (90 days - stable patterns, slow-moving image/web standards)
