import type { NewCollection } from '../schema.js';

export const collectionsData: NewCollection[] = [
  {
    name: 'Federal',
    slug: 'federal',
    description: 'How well do you really know Uncle Sam? Put your federal know-how to the test.',
    localeCode: 'en-US',
    localeName: 'United States',
    iconIdentifier: 'flag-us',
    themeColor: '#1E3A8A', // deep blue
    isActive: true,
    sortOrder: 1
  },
  {
    name: 'Bloomington, IN',
    slug: 'bloomington-in',
    description: 'B-Town bragging rights on the line. Show off your local civic smarts.',
    localeCode: 'en-US',
    localeName: 'Bloomington, Indiana',
    iconIdentifier: 'flag-in',
    themeColor: '#991B1B', // deep red - Indiana
    isActive: true,
    sortOrder: 2
  },
  {
    name: 'Los Angeles, CA',
    slug: 'los-angeles-ca',
    description: 'Think you know the City of Angels? Prove it — from City Hall to the Capitol.',
    localeCode: 'en-US',
    localeName: 'Los Angeles, California',
    iconIdentifier: 'flag-ca',
    themeColor: '#0369A1', // ocean blue - California
    isActive: true,
    sortOrder: 3
  }
];
