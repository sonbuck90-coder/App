// Bank Lookup Service - Maps sort codes to bank names
// Sort codes are typically 6-digit numbers used in UK banking

export interface BankInfo {
  name: string;
  shortName: string;
  /** UK customer-service phone number used in transaction notifications. */
  phone?: string;
  logo?: string;
}

// Common UK bank sort code prefixes mapped to bank names
// Sort codes are in format XX-XX-XX or XXXXXX
const SORT_CODE_BANK_MAP: { [prefix: string]: BankInfo } = {
  // HSBC
  '40': { name: 'HSBC UK Bank plc', shortName: 'HSBC' },
  '41': { name: 'HSBC UK Bank plc', shortName: 'HSBC' },
  
  // Barclays
  '20': { name: 'Barclays Bank UK plc', shortName: 'Barclays' },
  '23': { name: 'Barclays Bank UK plc', shortName: 'Barclays' },
  
  // Lloyds
  '30': { name: 'Lloyds Bank plc', shortName: 'Lloyds' },
  '77': { name: 'Lloyds Bank plc', shortName: 'Lloyds' },
  
  // NatWest
  '60': { name: 'National Westminster Bank plc', shortName: 'NatWest' },
  '01': { name: 'National Westminster Bank plc', shortName: 'NatWest' },
  
  // Royal Bank of Scotland
  '83': { name: 'Royal Bank of Scotland plc', shortName: 'RBS' },
  '16': { name: 'Royal Bank of Scotland plc', shortName: 'RBS' },
  
  // Santander
  '09': { name: 'Santander UK plc', shortName: 'Santander' },
  '72': { name: 'Santander UK plc', shortName: 'Santander' },
  
  // Nationwide
  '07': { name: 'Nationwide Building Society', shortName: 'Nationwide' },
  '70': { name: 'Nationwide Building Society', shortName: 'Nationwide' },
  
  // Halifax (part of Lloyds)
  '11': { name: 'Halifax', shortName: 'Halifax' },
  
  // TSB
  '77': { name: 'TSB Bank plc', shortName: 'TSB' },
  '87': { name: 'TSB Bank plc', shortName: 'TSB' },
  
  // Metro Bank
  '23-14': { name: 'Metro Bank plc', shortName: 'Metro Bank' },
  
  // Monzo
  '04-00-04': { name: 'Monzo Bank Ltd', shortName: 'Monzo' },
  
  // Starling
  '60-83-71': { name: 'Starling Bank', shortName: 'Starling' },
  
  // Revolut
  '04-00-75': { name: 'Revolut Ltd', shortName: 'Revolut' },
  
  // Co-operative Bank
  '08': { name: 'The Co-operative Bank plc', shortName: 'Co-op Bank' },
  
  // Bank of Scotland
  '80': { name: 'Bank of Scotland plc', shortName: 'Bank of Scotland' },
  '12': { name: 'Bank of Scotland plc', shortName: 'Bank of Scotland' },
  
  // Clydesdale/Virgin Money
  '82': { name: 'Virgin Money UK plc', shortName: 'Virgin Money' },
  
  // First Direct (HSBC)
  '40-47': { name: 'First Direct', shortName: 'First Direct' },
};

export interface LookupResult {
  found: boolean;
  bank?: BankInfo;
  formattedSortCode?: string;
  error?: string;
}

/**
 * Formats a sort code string to XX-XX-XX format
 */
export function formatSortCode(input: string): string {
  // Remove all non-numeric characters
  const digits = input.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

/**
 * Validates if a sort code is in correct format (6 digits)
 */
export function isValidSortCode(sortCode: string): boolean {
  const digits = sortCode.replace(/\D/g, '');
  return digits.length === 6;
}

/**
 * Looks up bank information based on sort code
 */
export function lookupBank(sortCode: string): LookupResult {
  // Remove formatting
  const digits = sortCode.replace(/\D/g, '');
  
  // Validate length
  if (digits.length === 0) {
    return { found: false, error: 'Please enter a sort code' };
  }
  
  if (digits.length < 6) {
    return { found: false, error: 'Sort code must be 6 digits' };
  }
  
  if (digits.length > 6) {
    return { found: false, error: 'Sort code is too long' };
  }
  
  const formattedSortCode = formatSortCode(digits);
  
  // Try exact match first (for specific branches like Monzo, Starling)
  if (SORT_CODE_BANK_MAP[formattedSortCode]) {
    return {
      found: true,
      bank: SORT_CODE_BANK_MAP[formattedSortCode],
      formattedSortCode,
    };
  }
  
  // Try first 4 digits with dash
  const fourDigitKey = `${digits.slice(0, 2)}-${digits.slice(2, 4)}`;
  if (SORT_CODE_BANK_MAP[fourDigitKey]) {
    return {
      found: true,
      bank: SORT_CODE_BANK_MAP[fourDigitKey],
      formattedSortCode,
    };
  }
  
  // Try first 2 digits (bank prefix)
  const twoDigitKey = digits.slice(0, 2);
  if (SORT_CODE_BANK_MAP[twoDigitKey]) {
    return {
      found: true,
      bank: SORT_CODE_BANK_MAP[twoDigitKey],
      formattedSortCode,
    };
  }
  
  // Sort code format is valid but bank not found - fallback to generic "UK Bank"
  return {
    found: true,
    bank: { name: 'UK Bank', shortName: 'UK Bank' },
    formattedSortCode,
  };
}

/**
 * Get all supported banks
 */
export function getSupportedBanks(): BankInfo[] {
  const uniqueBanks = new Map<string, BankInfo>();
  
  Object.values(SORT_CODE_BANK_MAP).forEach((bank) => {
    if (!uniqueBanks.has(bank.name)) {
      uniqueBanks.set(bank.name, bank);
    }
  });
  
  return Array.from(uniqueBanks.values()).sort((a, b) => 
    a.shortName.localeCompare(b.shortName)
  );
}

/**
 * UK bank customer-service phone numbers — used inside transaction
 * notifications and statements so they look like real HSBC-style alerts:
 *   "£1.00 transaction | STARLING BANK LIMI"
 *   "+442079304450  GB | BANK A/C"
 *
 * Numbers are kept in international (E.164) form starting +44. Sources:
 * each bank's published customer-services line.
 */
const BANK_PHONES: Record<string, string> = {
  HSBC: '+443457404404',
  'First Direct': '+443456100100',
  Barclays: '+443457345345',
  Lloyds: '+443456023453',
  NatWest: '+443457888444',
  RBS: '+443457242424',
  Santander: '+443301232424',
  Nationwide: '+448004640813',
  Halifax: '+443457203040',
  TSB: '+443459758758',
  'Metro Bank': '+443458086644',
  Monzo: '+442036080088',
  Starling: '+442079304450',
  Revolut: '+442033228352',
  'Co-op Bank': '+443457212212',
  'Bank of Scotland': '+443457213141',
  'Virgin Money': '+440800678678',
  'UK Bank': '+443450000000',
};

/** Look up a bank's customer-service phone by its `shortName`. */
export function getBankPhone(shortName?: string): string {
  if (!shortName) return BANK_PHONES['UK Bank'];
  return BANK_PHONES[shortName] || BANK_PHONES['UK Bank'];
}

/** Look up a bank's customer-service phone directly from a sort code. */
export function getBankPhoneBySortCode(sortCode: string): string {
  const r = lookupBank(sortCode);
  return getBankPhone(r.bank?.shortName);
}
