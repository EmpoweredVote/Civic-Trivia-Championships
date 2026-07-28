/**
 * Attribution registry for collection banner images.
 *
 * CC BY and CC BY-SA require the credit to be *visible* wherever the image is
 * used, which a repo-only note does not satisfy — hence the /credits page that
 * renders this list.
 *
 * Banners sourced from Empowered Vote's shared place-banner bucket
 * (`politician_photos/cities/…`, `…/states/…`) are curated and licence-checked
 * upstream; the canonical per-image registry lives in the comment block above
 * CURATED_LOCAL / STATE_PANORAMAS in the essentials repo's
 * `src/lib/buildingImages.js`. Entries copied here are marked `sharedBucket`.
 *
 * Collections added before this file exists have no recorded provenance and are
 * deliberately not listed rather than guessed at.
 */
export interface BannerCredit {
  /** Collection slug — resolves to /images/collections/<slug>.jpg */
  slug: string;
  /** Display name of the collection the banner belongs to */
  collection: string;
  /** Descriptive title of the photograph */
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  /** Page the image came from, for verification */
  sourceUrl: string;
  /** Whether the licence obliges us to display this credit */
  attributionRequired: boolean;
  /** Sourced from the Empowered Vote shared place-banner bucket */
  sharedBucket?: boolean;
}

export const BANNER_CREDITS: BannerCredit[] = [
  {
    slug: 'madison-wi',
    collection: 'Madison, WI',
    title: 'Skyline of Madison, Wisconsin — downtown across Lake Monona',
    author: 'John Benson',
    license: 'CC BY 2.5',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.5/',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Skyline_of_Madison,_Wisconsin_(cropped).jpg',
    attributionRequired: true,
    sharedBucket: true,
  },
  {
    slug: 'wisconsin',
    collection: 'Wisconsin',
    title: 'Wisconsin State Capitol, aerial view',
    author: 'Wikideas1',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Wisconsin_State_Capitol_Building_6.jpg',
    attributionRequired: false,
  },
  {
    slug: 'bend-or',
    collection: 'Bend, OR',
    title: 'Downtown Bend at sunrise, looking toward Pilot Butte',
    author: 'UpdateNerd',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Downtown_Bend_-_view_of_Pilot_Butte.jpg',
    attributionRequired: false,
  },
];

/** Credits the licence obliges us to display. */
export const REQUIRED_CREDITS = BANNER_CREDITS.filter(c => c.attributionRequired);
