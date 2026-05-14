/**
 * Confirmation of Payee (CoP) — the UK industry standard for verifying that
 * the recipient name the customer typed matches the actual account holder
 * for the given sort code + account number.
 *
 * We can't reach a live CoP service offline, so the result is computed
 * deterministically from the inputs. The same combination of name + sort
 * code + account always returns the same outcome, which matches how a real
 * bank's CoP response feels to a user.
 */
import { lookupBank } from './bank-lookup';
import { getDb, Payee } from './offline-store';

export type CopResult = 'match' | 'close_match' | 'no_match' | 'unchecked';

export interface CopResponse {
  result: CopResult;
  /** Name the bank reports for that account (only when `close_match`). */
  actualName?: string;
  /** Bank name from sort-code lookup, for the review display. */
  bankName?: string;
  /** Human-readable explanation shown to the user. */
  message: string;
}

function deterministicHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function normalise(name: string): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Performs a synthetic CoP check.
 *
 * Priorities:
 *  1. If the recipient is a saved payee with matching sort/account → match.
 *  2. If the sort code resolves to a known UK bank AND the name has 2+ words
 *     (i.e. plausibly a real full name) → match.
 *  3. Hash-based fallback so the result is deterministic.
 */
export async function checkPayee(
  recipientName: string,
  sortCode: string,
  accountNumber: string,
): Promise<CopResponse> {
  // simulate a short network roundtrip so the UI can show a spinner
  await new Promise((r) => setTimeout(r, 900));

  const cleanSort = (sortCode || '').replace(/\D/g, '');
  const cleanAccount = (accountNumber || '').replace(/\D/g, '');
  const cleanName = normalise(recipientName);

  // 1) Saved payee match — the strongest possible signal.
  try {
    const db = await getDb();
    const exact = db.payees.find((p: Payee) =>
      p.sort_code.replace(/\D/g, '') === cleanSort &&
      p.account_number.replace(/\D/g, '') === cleanAccount,
    );
    if (exact) {
      if (normalise(exact.name) === cleanName) {
        return {
          result: 'match',
          bankName: lookupBank(cleanSort)?.bankName,
          message: 'Verified — name matches the account holder.',
        };
      }
      return {
        result: 'close_match',
        actualName: exact.name,
        bankName: lookupBank(cleanSort)?.bankName,
        message: `Close match. The account holder is actually "${exact.name}".`,
      };
    }
  } catch {
    /* ignore */
  }

  // 2) Strong heuristic: real bank + plausible full name → match.
  const bank = lookupBank(cleanSort);
  const nameWords = cleanName.split(' ').filter((w) => w.length > 1);
  if (bank.found && nameWords.length >= 2) {
    return {
      result: 'match',
      bankName: bank.bankName,
      message: 'Verified — name matches the account holder.',
    };
  }

  // 3) Deterministic fallback — most cases still resolve to a match, with
  //    occasional close-match / no-match outcomes so the UX feels realistic.
  const hash = deterministicHash(`${cleanName}|${cleanSort}|${cleanAccount}`) % 10;
  if (hash < 7) {
    return {
      result: 'match',
      bankName: bank.bankName,
      message: 'Verified — name matches the account holder.',
    };
  }
  if (hash < 9) {
    return {
      result: 'close_match',
      bankName: bank.bankName,
      actualName: undefined,
      message: 'Close match. The recipient name is similar but not identical to the account holder. Please double-check before you continue.',
    };
  }
  return {
    result: 'no_match',
    bankName: bank.bankName,
    message: 'No match. The name you entered does not match the account holder for these details. The payment may go to the wrong person.',
  };
}
