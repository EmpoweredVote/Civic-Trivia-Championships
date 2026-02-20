---
phase: quick-010
plan: 01
subsystem: ui
tags: [react, images, collection-cards, banner, object-cover]

# Dependency graph
requires:
  - phase: quick-009
    provides: "Collection card fixed height layout and descriptions"
provides:
  - "Location banner photos on collection cards (federal, bloomington-in, los-angeles-ca)"
  - "Image-based CollectionCard with themeColor fallback"
affects: [new-collections, collection-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static image assets served from /images/collections/{slug}.jpg"
    - "CSS background-color fallback while images load"

key-files:
  created:
    - frontend/public/images/collections/federal.jpg
    - frontend/public/images/collections/bloomington-in.jpg
    - frontend/public/images/collections/los-angeles-ca.jpg
  modified:
    - frontend/src/features/collections/components/CollectionCard.tsx

key-decisions:
  - "Banner height h-28 (112px) for visual impact over previous h-14"
  - "Image path convention: /images/collections/{collection.slug}.jpg"
  - "Decorative alt='' since collection name is already in card body"

patterns-established:
  - "Collection banner images: add {slug}.jpg to public/images/collections/ for new collections"

# Metrics
duration: 3min
completed: 2026-02-20
---

# Quick Task 010: Collection Card Banner Images Summary

**Location photo banners on collection cards using slug-based image lookup with themeColor CSS fallback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T17:38:06Z
- **Completed:** 2026-02-20T17:41:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Downloaded three Wikimedia Commons location photos as banner images (federal, bloomington-in, los-angeles-ca)
- Replaced solid-color h-14 header band with h-28 photo banner using object-cover for distortion-free fill
- ThemeColor shows as CSS background while image loads or if image is missing (graceful fallback)
- Cards without a matching image file still render with the themeColor band

## Task Commits

Each task was committed atomically:

1. **Task 1: Download banner images to public assets** - `9440f57` (feat)
2. **Task 2: Update CollectionCard to show banner images** - `f1bae8f` (feat)

## Files Created/Modified
- `frontend/public/images/collections/federal.jpg` - US Capitol photo for Federal collection (123KB)
- `frontend/public/images/collections/bloomington-in.jpg` - Kirkwood Ave photo for Bloomington IN collection (172KB)
- `frontend/public/images/collections/los-angeles-ca.jpg` - Downtown skyline photo for Los Angeles CA collection (108KB)
- `frontend/src/features/collections/components/CollectionCard.tsx` - Updated to render img banner with object-cover, themeColor fallback, lazy loading

## Decisions Made
- Banner height increased from h-14 (56px) to h-28 (112px) for more visual impact with photos
- Image path convention uses collection.slug: `/images/collections/{slug}.jpg`
- Decorative `alt=""` since collection name is already displayed in the card body text
- `loading="lazy"` added for performance since off-screen cards don't need immediate image loads

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Steps
- When adding new collections, drop a `{slug}.jpg` image into `frontend/public/images/collections/`
- Consider optimizing images with WebP format and srcset for responsive sizes in the future

---
*Quick Task: 010-collection-card-banner-images*
*Completed: 2026-02-20*
