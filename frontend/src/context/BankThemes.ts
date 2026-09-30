/**
 * UK bank visual themes — primary, accent, header palettes for the
 * customisation screen. Selecting one applies it via `updateColors()`.
 *
 * Each theme also declares a `layout` family — the Home / Login screens
 * render completely different visual designs based on this value:
 *   - `classic`: traditional UK-bank list view (HSBC, Lloyds, etc.)
 *   - `modern`: dark-hero fintech style (Monzo, Starling, Revolut)
 *   - `minimal`: airy, large-typography light style (Barclays)
 *
 * Every theme also carries its own AI-assistant chatbot persona name
 * and a footer tagline that appears at the bottom of every transaction
 * receipt so the whole app rebrands cohesively when the theme changes.
 */

export type BankLayout = 'classic' | 'modern' | 'minimal';

export interface BankTheme {
  id: string;
  name: string;
  tagline: string;
  initials: string;
  layout: BankLayout;
  /** The AI-assistant chatbot's persona name for this bank. */
  chatbotName: string;
  /** Footer tagline shown on transaction receipts, e.g. "HSBC UK | Secure Banking". */
  footerTagline: string;
  colors: {
    primary: string;
    accent: string;
    header: string;
    gradientStart: string;
    gradientEnd: string;
  };
  /** Optional built-in hero image for the Home dashboard. Used when the
   *  user hasn't chosen their own dashboard photo for this theme. */
  defaultDashboard?: string;
}

export const BANK_THEMES: BankTheme[] = [
  {
    id: 'hsbc',
    name: 'HSBC UK',
    tagline: 'Opening up a world of opportunity',
    initials: 'HSBC',
    layout: 'classic',
    chatbotName: 'Ellie',
    footerTagline: 'HSBC UK | Secure Banking',
    colors: { primary: '#DB0011', accent: '#00847F', header: '#FFFFFF', gradientStart: '#DB0011', gradientEnd: '#8B0000' },
    // Signature "HSBC — Opening up a world of opportunity" hero photo:
    // a lone figure on a beach at sunset (user-provided asset).
    defaultDashboard: 'https://customer-assets-7cd3h4nn.emergentagent.net/job_vault-app-25/artifacts/0kd7ugg1_IMG_0149.jpeg',
  },
  {
    id: 'barclays',
    name: 'Barclays',
    tagline: 'Banking made personal',
    initials: 'B',
    layout: 'minimal',
    chatbotName: 'Barney',
    footerTagline: 'Barclays | Secure Banking',
    colors: { primary: '#00AEEF', accent: '#1C1C1C', header: '#00AEEF', gradientStart: '#00AEEF', gradientEnd: '#0072BC' },
  },
  {
    id: 'lloyds',
    name: 'Lloyds Bank',
    tagline: 'By your side',
    initials: 'L',
    layout: 'classic',
    chatbotName: 'Louis',
    footerTagline: 'Lloyds Bank | Secure Banking',
    colors: { primary: '#024731', accent: '#76BC21', header: '#024731', gradientStart: '#024731', gradientEnd: '#013922' },
  },
  {
    id: 'natwest',
    name: 'NatWest',
    tagline: 'Helpful banking',
    initials: 'NW',
    layout: 'classic',
    chatbotName: 'Cora',
    footerTagline: 'NatWest | Secure Banking',
    colors: { primary: '#3C1053', accent: '#E87722', header: '#3C1053', gradientStart: '#3C1053', gradientEnd: '#2A0B3D' },
  },
  {
    id: 'santander',
    name: 'Santander',
    tagline: 'Simple. Personal. Fair.',
    initials: 'S',
    layout: 'classic',
    chatbotName: 'Sandy',
    footerTagline: 'Santander | Secure Banking',
    colors: { primary: '#EC0000', accent: '#000000', header: '#EC0000', gradientStart: '#EC0000', gradientEnd: '#B30000' },
  },
  {
    id: 'halifax',
    name: 'Halifax',
    tagline: "It's a people thing",
    initials: 'H',
    layout: 'classic',
    chatbotName: 'Harry',
    footerTagline: 'Halifax | Secure Banking',
    colors: { primary: '#00529C', accent: '#E2231A', header: '#00529C', gradientStart: '#00529C', gradientEnd: '#003A6E' },
  },
  {
    id: 'monzo',
    name: 'Monzo',
    tagline: 'Banking made easy',
    initials: 'M',
    layout: 'modern',
    chatbotName: 'Mo',
    footerTagline: 'Monzo Bank | Secure Banking',
    colors: { primary: '#14233C', accent: '#FF4F40', header: '#14233C', gradientStart: '#14233C', gradientEnd: '#0A1424' },
  },
  {
    id: 'starling',
    name: 'Starling Bank',
    tagline: 'The bank built for you',
    initials: 'S',
    layout: 'modern',
    chatbotName: 'Stella',
    footerTagline: 'Starling Bank | Secure Banking',
    colors: { primary: '#6435C9', accent: '#16C79A', header: '#6435C9', gradientStart: '#6435C9', gradientEnd: '#4A1FAD' },
  },
  {
    id: 'revolut',
    name: 'Revolut',
    tagline: 'One app, all things money',
    initials: 'R',
    layout: 'modern',
    chatbotName: 'Rev',
    footerTagline: 'Revolut | Secure Banking',
    colors: { primary: '#0B1424', accent: '#0075EB', header: '#0B1424', gradientStart: '#0B1424', gradientEnd: '#000000' },
  },
  {
    id: 'nationwide',
    name: 'Nationwide',
    tagline: 'Building society, nationwide good',
    initials: 'N',
    layout: 'classic',
    chatbotName: 'Nia',
    footerTagline: 'Nationwide | Secure Banking',
    colors: { primary: '#00549F', accent: '#E32B26', header: '#00549F', gradientStart: '#00549F', gradientEnd: '#003A73' },
  },
  {
    id: 'tsb',
    name: 'TSB',
    tagline: 'Life made more',
    initials: 'TSB',
    layout: 'classic',
    chatbotName: 'Tessa',
    footerTagline: 'TSB | Secure Banking',
    colors: { primary: '#00518B', accent: '#76C2D8', header: '#00518B', gradientStart: '#00518B', gradientEnd: '#003C66' },
  },
  {
    id: 'firstdirect',
    name: 'first direct',
    tagline: 'Banking by phone, internet & app',
    initials: 'fd',
    layout: 'classic',
    chatbotName: 'Freya',
    footerTagline: 'first direct | Secure Banking',
    colors: { primary: '#000000', accent: '#FFCD00', header: '#000000', gradientStart: '#000000', gradientEnd: '#1A1A1A' },
  },
];

/** Look up the full theme record by id, defaulting to HSBC UK. */
export function getBankTheme(bankId?: string): BankTheme {
  return BANK_THEMES.find((t) => t.id === bankId) || BANK_THEMES[0];
}

export function getLayoutFor(bankId: string): BankLayout {
  return getBankTheme(bankId).layout;
}

/** Convenience: chatbot persona name for a given theme id. */
export function getChatbotName(bankId?: string): string {
  return getBankTheme(bankId).chatbotName;
}

/** Convenience: footer tagline for a given theme id. */
export function getFooterTagline(bankId?: string): string {
  return getBankTheme(bankId).footerTagline;
}
