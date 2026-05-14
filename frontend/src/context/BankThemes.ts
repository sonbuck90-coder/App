/**
 * UK bank visual themes — primary, accent, header palettes for the
 * customisation screen. Selecting one applies it via `updateColors()`.
 *
 * Colours are drawn from each bank's most-recognisable brand palette and
 * tuned so that white text remains legible on the header.
 */

export interface BankTheme {
  id: string;
  name: string;
  tagline: string;
  // monogram used as a fallback logo when no gallery image is set
  initials: string;
  colors: {
    primary: string;
    accent: string;
    header: string;
    gradientStart: string;
    gradientEnd: string;
  };
}

export const BANK_THEMES: BankTheme[] = [
  {
    id: 'hsbc',
    name: 'HSBC UK',
    tagline: 'Opening up a world of opportunity',
    initials: 'HSBC',
    colors: {
      primary: '#DB0011',
      accent: '#00847F',
      header: '#FFFFFF',
      gradientStart: '#DB0011',
      gradientEnd: '#8B0000',
    },
  },
  {
    id: 'barclays',
    name: 'Barclays',
    tagline: 'Banking made personal',
    initials: 'B',
    colors: {
      primary: '#00AEEF',
      accent: '#1C1C1C',
      header: '#00AEEF',
      gradientStart: '#00AEEF',
      gradientEnd: '#0072BC',
    },
  },
  {
    id: 'lloyds',
    name: 'Lloyds Bank',
    tagline: 'By your side',
    initials: 'L',
    colors: {
      primary: '#024731',
      accent: '#76BC21',
      header: '#024731',
      gradientStart: '#024731',
      gradientEnd: '#013922',
    },
  },
  {
    id: 'natwest',
    name: 'NatWest',
    tagline: 'Helpful banking',
    initials: 'NW',
    colors: {
      primary: '#3C1053',
      accent: '#E87722',
      header: '#3C1053',
      gradientStart: '#3C1053',
      gradientEnd: '#2A0B3D',
    },
  },
  {
    id: 'santander',
    name: 'Santander',
    tagline: 'Simple. Personal. Fair.',
    initials: 'S',
    colors: {
      primary: '#EC0000',
      accent: '#000000',
      header: '#EC0000',
      gradientStart: '#EC0000',
      gradientEnd: '#B30000',
    },
  },
  {
    id: 'halifax',
    name: 'Halifax',
    tagline: "It's a people thing",
    initials: 'H',
    colors: {
      primary: '#00529C',
      accent: '#E2231A',
      header: '#00529C',
      gradientStart: '#00529C',
      gradientEnd: '#003A6E',
    },
  },
  {
    id: 'monzo',
    name: 'Monzo',
    tagline: 'Banking made easy',
    initials: 'M',
    colors: {
      primary: '#14233C',
      accent: '#FF4F40',
      header: '#14233C',
      gradientStart: '#14233C',
      gradientEnd: '#0A1424',
    },
  },
  {
    id: 'starling',
    name: 'Starling Bank',
    tagline: 'The bank built for you',
    initials: 'S',
    colors: {
      primary: '#6435C9',
      accent: '#16C79A',
      header: '#6435C9',
      gradientStart: '#6435C9',
      gradientEnd: '#4A1FAD',
    },
  },
  {
    id: 'revolut',
    name: 'Revolut',
    tagline: 'One app, all things money',
    initials: 'R',
    colors: {
      primary: '#0075EB',
      accent: '#1A1A1A',
      header: '#0B1424',
      gradientStart: '#0B1424',
      gradientEnd: '#000000',
    },
  },
  {
    id: 'nationwide',
    name: 'Nationwide',
    tagline: 'Building society, nationwide good',
    initials: 'N',
    colors: {
      primary: '#00549F',
      accent: '#E32B26',
      header: '#00549F',
      gradientStart: '#00549F',
      gradientEnd: '#003A73',
    },
  },
  {
    id: 'tsb',
    name: 'TSB',
    tagline: 'Life made more',
    initials: 'TSB',
    colors: {
      primary: '#00518B',
      accent: '#76C2D8',
      header: '#00518B',
      gradientStart: '#00518B',
      gradientEnd: '#003C66',
    },
  },
  {
    id: 'firstdirect',
    name: 'first direct',
    tagline: 'Banking by phone, internet & app',
    initials: 'fd',
    colors: {
      primary: '#000000',
      accent: '#FFCD00',
      header: '#000000',
      gradientStart: '#000000',
      gradientEnd: '#1A1A1A',
    },
  },
];
