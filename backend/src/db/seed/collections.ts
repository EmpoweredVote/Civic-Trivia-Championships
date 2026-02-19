import type { NewCollection } from '../schema.js';

export const collectionsData: NewCollection[] = [
  {
    name: 'Federal Civics',
    slug: 'federal',
    description: 'Test your knowledge of U.S. federal government, the Constitution, and how democracy works at the national level.',
    localeCode: 'en-US',
    localeName: 'United States',
    iconIdentifier: 'flag-us',
    themeColor: '#1E3A8A', // deep blue
    isActive: true,
    sortOrder: 1
  },
  {
    name: 'Bloomington, IN Civics',
    slug: 'bloomington-in',
    description: 'Explore Bloomington city government, Indiana state civics, and what makes local democracy work in Monroe County.',
    localeCode: 'en-US',
    localeName: 'Bloomington, Indiana',
    iconIdentifier: 'flag-in',
    themeColor: '#991B1B', // deep red - Indiana
    isActive: true,
    sortOrder: 2
  },
  {
    name: 'Los Angeles, CA Civics',
    slug: 'los-angeles-ca',
    description: 'Discover how Los Angeles city government works, California state civics, and the issues shaping the nation\'s second-largest city.',
    localeCode: 'en-US',
    localeName: 'Los Angeles, California',
    iconIdentifier: 'flag-ca',
    themeColor: '#0369A1', // ocean blue - California
    isActive: true,
    sortOrder: 3
  }
];
