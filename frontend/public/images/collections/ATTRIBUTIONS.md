# Collection banner image attributions

**The user-facing credit lives at `/credits`**, rendered from
`frontend/src/data/bannerCredits.ts`. CC BY and CC BY-SA require the credit to
be *visible* where the image is used, which this file does not satisfy on its
own — update the registry, not just this note.

Banners marked *shared bucket* come from Empowered Vote's curated place-banner
library (`politician_photos/cities/…`, `…/states/…`); the canonical upstream
registry is the comment block above `CURATED_LOCAL` / `STATE_PANORAMAS` in the
essentials repo's `src/lib/buildingImages.js`.

| File | Source | Author | License | Notes |
|------|--------|--------|---------|-------|
| `madison-wi.jpg` | [Skyline of Madison, Wisconsin (cropped)](https://commons.wikimedia.org/wiki/File:Skyline_of_Madison,_Wisconsin_(cropped).jpg) | John Benson | [CC BY 2.5](https://creativecommons.org/licenses/by/2.5/) | Shared bucket, `cities/madison.jpg`. Credit required. |
| `milwaukee-wi.jpg` | [Milwaukee Art Museum 7043](https://commons.wikimedia.org/wiki/File:Milwaukee_Art_Museum_7043.jpg) | Dori | [CC BY-SA 3.0 US](https://creativecommons.org/licenses/by-sa/3.0/us/deed.en) | Credit required. ShareAlike — used unmodified apart from downscaling; do not crop or composite without relicensing the result. |
| `wisconsin.jpg` | [Wisconsin State Capitol Building 6](https://commons.wikimedia.org/wiki/File:Wisconsin_State_Capitol_Building_6.jpg) | Wikideas1 | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | No obligation. |
| `bend-or.jpg` | [Downtown Bend - view of Pilot Butte](https://commons.wikimedia.org/wiki/File:Downtown_Bend_-_view_of_Pilot_Butte.jpg) | UpdateNerd | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | No obligation. |

Banners predating this file have no recorded provenance.

## Choosing a banner for CTC — crop geometry

CTC crops on the **opposite axis** from the essentials app, so guidance written
for that app does not transfer.

Cards render the image in a **fixed-height** box (160px in `CollectionCard`,
180px on the Dashboard) at card width, with `object-fit: cover`. Card widths run
roughly 173px (2-up mobile) to ~296px (4-up xl), so the box is about **1.1:1 to
1.9:1** — far narrower than the shared bucket's 3.148:1 (1700×540) frame.

`cover` therefore matches the **height** and overflows the width: CTC keeps
**100% of the vertical** and shows only the **middle ~34–59% horizontally**.

- For CTC, the subject must be **horizontally centred**. Wide panoramas lose
  their ends — on mobile only the middle third survives.
- The essentials warning to "keep subjects in a horizontal band" addresses their
  *vertical* crop and is not the binding constraint here.

The shared bucket's Madison banner centres the Capitol dome, so it survives
CTC's crop at every breakpoint.
