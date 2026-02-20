---
phase: quick-010
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/public/images/collections/federal.jpg
  - frontend/public/images/collections/bloomington-in.jpg
  - frontend/public/images/collections/los-angeles-ca.jpg
  - frontend/src/features/collections/components/CollectionCard.tsx
autonomous: true

must_haves:
  truths:
    - "Each collection card displays a location photo banner instead of a solid color band"
    - "Banner images load quickly and cover the full width without distortion"
    - "ThemeColor shows as background while image loads (graceful fallback)"
    - "Cards with no matching image file still render with the themeColor band"
  artifacts:
    - path: "frontend/public/images/collections/federal.jpg"
      provides: "US Capitol banner image for Federal collection"
    - path: "frontend/public/images/collections/bloomington-in.jpg"
      provides: "Kirkwood Ave banner image for Bloomington IN collection"
    - path: "frontend/public/images/collections/los-angeles-ca.jpg"
      provides: "Downtown skyline banner image for Los Angeles CA collection"
    - path: "frontend/src/features/collections/components/CollectionCard.tsx"
      provides: "Updated card component with img tag banner"
      contains: "object-cover"
  key_links:
    - from: "CollectionCard.tsx"
      to: "/images/collections/{slug}.jpg"
      via: "img src using collection.slug"
      pattern: "src=.*images/collections.*slug"
---

<objective>
Replace the solid-color header band on collection cards with location banner photos.

Purpose: Make collection cards visually engaging with real photos of each location.
Output: Three banner images in public assets and an updated CollectionCard component.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@frontend/src/features/collections/components/CollectionCard.tsx
@frontend/src/features/collections/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Download banner images to public assets</name>
  <files>
    frontend/public/images/collections/federal.jpg
    frontend/public/images/collections/bloomington-in.jpg
    frontend/public/images/collections/los-angeles-ca.jpg
  </files>
  <action>
    Create the directory `frontend/public/images/collections/` if it does not exist.

    Download three images using curl (follow redirects with -L, output to file with -o):

    1. Federal (US Capitol):
       URL: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/United_States_Capitol_west_front_edit2.jpg/960px-United_States_Capitol_west_front_edit2.jpg`
       Save as: `frontend/public/images/collections/federal.jpg`

    2. Bloomington, IN (Kirkwood Ave):
       URL: `https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Bloomington_IN_Kirkwood.jpg/960px-Bloomington_IN_Kirkwood.jpg`
       Save as: `frontend/public/images/collections/bloomington-in.jpg`

    3. Los Angeles, CA (downtown skyline):
       URL: `https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Downtown_Los_Angeles_Skyline_from_10_freeway.jpg/960px-Downtown_Los_Angeles_Skyline_from_10_freeway.jpg`
       Save as: `frontend/public/images/collections/los-angeles-ca.jpg`

    Verify each file downloaded successfully (non-zero file size).
  </action>
  <verify>
    Run `ls -la frontend/public/images/collections/` and confirm all three .jpg files exist with reasonable file sizes (each should be at least 30KB).
  </verify>
  <done>Three banner images exist in frontend/public/images/collections/ -- federal.jpg, bloomington-in.jpg, los-angeles-ca.jpg</done>
</task>

<task type="auto">
  <name>Task 2: Update CollectionCard to show banner images</name>
  <files>frontend/src/features/collections/components/CollectionCard.tsx</files>
  <action>
    Modify CollectionCard.tsx to replace the solid color div (lines 26-30) with an image banner:

    1. Replace the colored header `<div>` with a container div + img:
       ```tsx
       {/* Banner image with themeColor fallback */}
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

    Key details:
    - Height changed from `h-14` (56px) to `h-28` (112px) for a more visual banner
    - The wrapper div keeps `rounded-t-xl` and has `overflow-hidden` so the image respects the rounded corners
    - `style={{ backgroundColor: collection.themeColor }}` on the wrapper acts as fallback while image loads or if image is missing
    - The `<img>` uses `object-cover` to fill the banner area without distortion
    - `alt=""` because the image is decorative (the collection name is already in the card body)
    - `loading="lazy"` for performance since cards may be off-screen

    Do NOT change anything else in the component -- the card body, checkmark indicator, button wrapper, and accessibility attributes all stay the same.
  </action>
  <verify>
    Run `npx tsc --noEmit` from the frontend directory to confirm no TypeScript errors.
    Run the dev server and visually confirm collection cards show banner photos.
  </verify>
  <done>CollectionCard renders location photos as banners with h-28 height, object-cover fit, themeColor fallback, and rounded top corners preserved</done>
</task>

</tasks>

<verification>
1. `ls -la frontend/public/images/collections/` shows 3 jpg files with non-zero sizes
2. `npx tsc --noEmit` passes with no errors from the frontend directory
3. Visual check: collection cards display photo banners instead of solid color bands
</verification>

<success_criteria>
- Three location banner images downloaded and available as static assets
- CollectionCard component renders img tags with object-cover instead of solid color divs
- ThemeColor visible as background while images load
- No TypeScript errors introduced
</success_criteria>

<output>
After completion, create `.planning/quick/010-collection-card-banner-images/010-SUMMARY.md`
</output>
