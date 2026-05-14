/**
 * Offline data store backed by AsyncStorage.
 *
 * The app talks to this through `offline-adapter.ts`, which intercepts every
 * axios call and dispatches it here. The FastAPI backend is no longer
 * required: every read/write happens locally, so the app works fully offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'hsbc_offline_db_v1';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  account_number: string;
  sort_code: string;
  account_type: 'checking' | 'savings';
  balance: number;
  currency: string;
}

export interface Card {
  id: string;
  user_id: string;
  card_number: string;
  card_number_masked: string;
  card_type: 'debit' | 'credit';
  card_name: string;
  expiry_date: string;
  cvv: string;
  is_frozen: boolean;
  credit_limit?: number;
  available_credit?: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  from_account_id?: string | null;
  to_account_id?: string | null;
  amount: number;
  transaction_type: string;
  description: string;
  recipient_name?: string;
  recipient_sort_code?: string;
  recipient_account_number?: string;
  recipient_bank_name?: string;
  reference?: string;
  trn?: string;
  fpid?: string;
  status: string;
  timestamp: string;
}

export interface Payee {
  id: string;
  user_id: string;
  name: string;
  sort_code: string;
  account_number: string;
  last_used: string;
}

export interface Biller {
  id: string;
  name: string;
  category: string;
  account_number: string;
  icon: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  is_read: boolean;
  data?: any;
  timestamp: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  source: string;
  frequency: string;
  next_run: string;
  end_date?: string | null;
  is_active: boolean;
  created_at: string;
}

interface OfflineDB {
  profile: Profile;
  accounts: Account[];
  cards: Card[];
  transactions: Transaction[];
  payees: Payee[];
  billers: Biller[];
  notifications: AppNotification[];
  schedules: Schedule[];
  budgets?: BudgetState;
}

export interface BudgetState {
  /** YYYY-MM the limits were last reset for */
  month: string;
  categories: Record<string, CategoryBudget>;
}

export interface CategoryBudget {
  limit: number;
  alerted80: boolean;
  alerted100: boolean;
}

/** Categories we recognise for budgets — match the analytics screen. */
export const BUDGET_CATEGORIES = ['Bills', 'Transfers', 'Other'] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export function classifyTxn(transaction_type: string): BudgetCategory {
  if (transaction_type === 'payment') return 'Bills';
  if (transaction_type === 'transfer') return 'Transfers';
  return 'Other';
}

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------
function uid() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

function isoNow() {
  return new Date().toISOString();
}

function maskCard(num: string) {
  const clean = num.replace(/\s/g, '');
  return `**** **** **** ${clean.slice(-4)}`;
}

// -----------------------------------------------------------------------------
// Seed data
// -----------------------------------------------------------------------------
function buildSeed(): OfflineDB {
  const userId = uid();

  const profile: Profile = {
    id: userId,
    email: 'customer@hsbc.co.uk',
    name: 'Oliver',
    phone: '+44 7700 900000',
    address: '8 Canada Square, London E14 5HQ',
    created_at: isoNow(),
  };

  const checking: Account = {
    id: uid(),
    user_id: userId,
    account_number: '92647194',
    sort_code: '44-91-51',
    account_type: 'checking',
    balance: 14297.5,
    currency: 'GBP',
  };

  const savings: Account = {
    id: uid(),
    user_id: userId,
    account_number: '83001942',
    sort_code: '44-91-51',
    account_type: 'savings',
    balance: 9999.61,
    currency: 'GBP',
  };

  const debit: Card = {
    id: uid(),
    user_id: userId,
    card_number: '5273400012345678',
    card_number_masked: maskCard('5273400012345678'),
    card_type: 'debit',
    card_name: 'HSBC Visa Debit',
    expiry_date: '12/28',
    cvv: '***',
    is_frozen: false,
  };

  const credit: Card = {
    id: uid(),
    user_id: userId,
    card_number: '5273400098765432',
    card_number_masked: maskCard('5273400098765432'),
    card_type: 'credit',
    card_name: 'HSBC Mastercard Platinum',
    expiry_date: '06/29',
    cvv: '***',
    is_frozen: false,
    credit_limit: 15000,
    available_credit: 12500,
  };

  // Build transactions — last ~30 days, mix of debits & deposits
  const templates: Array<[string, string, string, number]> = [
    ['transfer', 'Rent Payment', 'Landlord Properties', 1100],
    ['deposit', 'Monthly Salary', 'ABC Company Ltd', 2850],
    ['payment', 'Bill payment - Electric Company', 'British Gas', 86.4],
    ['payment', 'Bill payment - Internet Provider', 'BT Broadband', 39.0],
    ['payment', 'Bill payment - Mobile Carrier', 'Vodafone UK', 28.5],
    ['transfer', 'Grocery Shopping', 'Tesco Superstore', 64.2],
    ['transfer', 'Online Purchase', 'Amazon UK', 47.99],
    ['payment', 'Bill payment - Water Services', 'Thames Water', 32.1],
    ['deposit', 'Refund', 'ASOS Returns', 22.5],
    ['transfer', 'Coffee Shop', 'Costa Coffee', 4.8],
    ['transfer', 'Transport', 'TfL Oyster', 18.7],
    ['payment', 'Bill payment - Insurance', 'Aviva Insurance', 54.0],
    ['transfer', 'Restaurant', 'Pizza Express', 38.6],
    ['deposit', 'Birthday Gift', 'Jane Smith', 50.0],
    ['transfer', 'Gym Membership', 'PureGym', 24.99],
    ['transfer', 'Cinema Tickets', 'Odeon Cinemas', 22.0],
    ['deposit', 'Freelance Work', 'Design Co Ltd', 480.0],
    ['transfer', 'Subscription', 'Netflix UK', 11.99],
    ['transfer', 'Pharmacy', 'Boots', 16.3],
    ['transfer', 'Taxi', 'Uber', 14.5],
  ];

  const now = Date.now();
  const transactions: Transaction[] = templates.map(([type, desc, recipient, amount], i) => {
    const ts = new Date(now - (i + 1) * 24 * 3600 * 1000 - Math.random() * 12 * 3600 * 1000);
    return {
      id: uid(),
      user_id: userId,
      from_account_id: type !== 'deposit' ? checking.id : null,
      to_account_id: type === 'deposit' ? checking.id : null,
      amount,
      transaction_type: type,
      description: desc,
      recipient_name: recipient,
      reference: `REF${100000 + i}`,
      trn: `TRN${(Math.floor(Math.random() * 1e10)).toString().padStart(10, '0')}`,
      fpid: `FP${(Math.floor(Math.random() * 1e12)).toString().padStart(12, '0')}`,
      status: 'completed',
      timestamp: ts.toISOString(),
    };
  });

  const payees: Payee[] = [
    {
      id: uid(),
      user_id: userId,
      name: 'Jane Smith',
      sort_code: '40-47-84',
      account_number: '12345678',
      last_used: isoNow(),
    },
    {
      id: uid(),
      user_id: userId,
      name: 'Maria Garcia',
      sort_code: '20-30-40',
      account_number: '87654321',
      last_used: isoNow(),
    },
  ];

  const billers: Biller[] = [
    { id: uid(), name: 'British Gas', category: 'Energy', account_number: 'BG-998877', icon: 'flash' },
    { id: uid(), name: 'Thames Water', category: 'Water', account_number: 'TW-554433', icon: 'water' },
    { id: uid(), name: 'BT Broadband', category: 'Internet', account_number: 'BT-112233', icon: 'wifi' },
    { id: uid(), name: 'Vodafone UK', category: 'Mobile', account_number: 'VF-887766', icon: 'phone-portrait' },
    { id: uid(), name: 'TfL Congestion', category: 'Transport', account_number: 'TFL-2099', icon: 'car' },
    { id: uid(), name: 'Council Tax', category: 'Tax', account_number: 'CT-998211', icon: 'document-text' },
  ];

  const notifications: AppNotification[] = [
    {
      id: uid(),
      user_id: userId,
      title: 'Welcome to HSBC UK',
      body: `Hi ${profile.name}, your accounts are ready with £${checking.balance.toFixed(
        2,
      )} in Current and £${savings.balance.toFixed(2)} in Savings.`,
      notification_type: 'welcome',
      is_read: false,
      timestamp: isoNow(),
    },
    {
      id: uid(),
      user_id: userId,
      title: 'Statement available',
      body: 'Your latest monthly statement is ready for download.',
      notification_type: 'statement',
      is_read: false,
      timestamp: isoNow(),
    },
  ];

  return {
    profile,
    accounts: [checking, savings],
    cards: [debit, credit],
    transactions,
    payees,
    billers,
    notifications,
    schedules: [],
  };
}

// -----------------------------------------------------------------------------
// Load / save
// -----------------------------------------------------------------------------
let cached: OfflineDB | null = null;
let loadPromise: Promise<OfflineDB> | null = null;

export async function getDb(): Promise<OfflineDB> {
  if (cached) return cached;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        cached = JSON.parse(raw) as OfflineDB;
      } else {
        cached = buildSeed();
        await persist();
      }
      return cached!;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

export async function persist() {
  if (!cached) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch (e) {
    console.error('offline-store: persist failed', e);
  }
}

export async function resetDb() {
  cached = buildSeed();
  await persist();
  return cached;
}

// -----------------------------------------------------------------------------
// Mutations / helpers used by the adapter
// -----------------------------------------------------------------------------
export async function addTransaction(t: Omit<Transaction, 'id'>): Promise<Transaction> {
  const db = await getDb();
  const txn: Transaction = { ...t, id: uid() };
  db.transactions.unshift(txn);
  await persist();
  return txn;
}

export async function addNotification(n: Omit<AppNotification, 'id'>): Promise<AppNotification> {
  const db = await getDb();
  const note: AppNotification = { ...n, id: uid() };
  db.notifications.unshift(note);
  await persist();
  return note;
}

export function newId() {
  return uid();
}

// -----------------------------------------------------------------------------
// Budgets
// -----------------------------------------------------------------------------
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Lazily initialise / reset budgets for the current month. */
export async function getBudgets(): Promise<BudgetState> {
  const db = await getDb();
  const key = currentMonthKey();
  if (!db.budgets) {
    db.budgets = {
      month: key,
      categories: {
        Bills: { limit: 0, alerted80: false, alerted100: false },
        Transfers: { limit: 0, alerted80: false, alerted100: false },
        Other: { limit: 0, alerted80: false, alerted100: false },
      },
    };
    await persist();
  } else if (db.budgets.month !== key) {
    // New month → reset the "alerted" flags so notifications fire again.
    db.budgets.month = key;
    Object.values(db.budgets.categories).forEach((c) => {
      c.alerted80 = false;
      c.alerted100 = false;
    });
    await persist();
  }
  return db.budgets;
}

/**
 * Compute the spend so far this month for each category.
 * Returns a map: category → spent amount.
 */
export async function monthlySpendByCategory(): Promise<Record<string, number>> {
  const db = await getDb();
  const now = new Date();
  const out: Record<string, number> = { Bills: 0, Transfers: 0, Other: 0 };
  db.transactions.forEach((t) => {
    if (t.transaction_type === 'deposit') return;
    const ts = new Date(t.timestamp);
    if (ts.getMonth() !== now.getMonth() || ts.getFullYear() !== now.getFullYear()) return;
    const cat = classifyTxn(t.transaction_type);
    out[cat] = (out[cat] || 0) + t.amount;
  });
  return out;
}

export async function setBudgetLimit(cat: string, limit: number) {
  const b = await getBudgets();
  if (!b.categories[cat]) {
    b.categories[cat] = { limit: 0, alerted80: false, alerted100: false };
  }
  b.categories[cat].limit = Math.max(0, +limit.toFixed(2));
  // Resetting the limit allows future alerts again
  b.categories[cat].alerted80 = false;
  b.categories[cat].alerted100 = false;
  await persist();
  return b;
}

/**
 * Should be called right after each spending transaction is persisted.
 * Returns an array of alert payloads that the caller (offline-adapter)
 * should turn into user-visible notifications.
 */
export async function checkBudgetAlerts(category: string): Promise<
  Array<{ category: string; spent: number; limit: number; level: 80 | 100 }>
> {
  const b = await getBudgets();
  const slot = b.categories[category];
  if (!slot || slot.limit <= 0) return [];
  const spend = await monthlySpendByCategory();
  const spent = spend[category] || 0;
  const pct = (spent / slot.limit) * 100;
  const alerts: Array<{ category: string; spent: number; limit: number; level: 80 | 100 }> = [];
  if (pct >= 100 && !slot.alerted100) {
    slot.alerted100 = true;
    slot.alerted80 = true; // implicitly
    alerts.push({ category, spent, limit: slot.limit, level: 100 });
  } else if (pct >= 80 && !slot.alerted80) {
    slot.alerted80 = true;
    alerts.push({ category, spent, limit: slot.limit, level: 80 });
  }
  if (alerts.length > 0) await persist();
  return alerts;
}

// -----------------------------------------------------------------------------
// Scheduled deposits — background auto-execution
// -----------------------------------------------------------------------------

/**
 * Move `next_run` forward by one frequency tick.
 *
 * Supported frequency values are the same strings the schedule UI uses:
 * `daily`, `weekly`, `biweekly` / `fortnightly`, `monthly`, `yearly`.
 */
function advanceSchedule(d: Date, frequency: string): Date {
  const next = new Date(d);
  const f = (frequency || 'monthly').toLowerCase();
  if (f === 'daily') next.setDate(next.getDate() + 1);
  else if (f === 'weekly') next.setDate(next.getDate() + 7);
  else if (f === 'biweekly' || f === 'fortnightly') next.setDate(next.getDate() + 14);
  else if (f === 'yearly' || f === 'annual') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1); // monthly is the default
  return next;
}

export interface ScheduleRunOutcome {
  schedule_id: string;
  account_id: string;
  amount: number;
  source: string;
  runs_executed: number;
}

/**
 * Execute every active schedule that is due (next_run <= now).
 *
 * Designed to be idempotent and safe to call multiple times:
 *   - On every app launch (from `_layout.tsx`)
 *   - When the user opens the schedules screen
 *   - On focus events
 *
 * Each due schedule is processed as a real deposit so balances, the
 * transaction list, and notifications stay perfectly in sync. If the user
 * hasn't opened the app for several periods we catch up by looping until
 * `next_run` is in the future.
 */
export async function runDueSchedules(): Promise<ScheduleRunOutcome[]> {
  const db = await getDb();
  const now = new Date();
  const outcomes: ScheduleRunOutcome[] = [];

  for (const sched of db.schedules) {
    if (!sched.is_active) continue;
    if (sched.end_date && new Date(sched.end_date) < now) {
      // Already past its end date — deactivate and skip.
      sched.is_active = false;
      continue;
    }

    let runs = 0;
    let nextRun = new Date(sched.next_run);
    // Safety cap of 60 catch-up runs so a stale date can't lock the loop.
    while (nextRun <= now && runs < 60) {
      if (sched.end_date && nextRun > new Date(sched.end_date)) break;

      const acct = db.accounts.find((a) => a.id === sched.account_id);
      if (!acct) break;

      acct.balance = +(acct.balance + sched.amount).toFixed(2);
      db.transactions.unshift({
        id: uid(),
        user_id: db.profile.id,
        to_account_id: acct.id,
        amount: sched.amount,
        transaction_type: 'deposit',
        description: `Scheduled deposit — ${sched.source}`,
        recipient_name: sched.source || 'Scheduled deposit',
        reference: `SCH${Math.floor(Math.random() * 1e6)}`,
        status: 'completed',
        timestamp: nextRun.toISOString(),
      });
      runs += 1;
      nextRun = advanceSchedule(nextRun, sched.frequency);
    }

    if (runs > 0) {
      sched.next_run = nextRun.toISOString();
      outcomes.push({
        schedule_id: sched.id,
        account_id: sched.account_id,
        amount: sched.amount,
        source: sched.source,
        runs_executed: runs,
      });
    }

    // If the schedule has hit its end date during catch-up, deactivate.
    if (sched.end_date && nextRun > new Date(sched.end_date)) {
      sched.is_active = false;
    }
  }

  if (outcomes.length > 0) await persist();
  return outcomes;
}



// FX rates table — used while offline. Values are GBP base.
export const FX_RATES_GBP: Record<string, number> = {
  GBP: 1.0,
  USD: 1.27,
  EUR: 1.17,
  AUD: 1.92,
  CAD: 1.72,
  JPY: 197.5,
  CHF: 1.11,
  INR: 106.3,
  HKD: 9.92,
  SGD: 1.71,
  AED: 4.66,
  NZD: 2.05,
};

export const FX_CURRENCIES = [
  { code: 'USD', name: 'United States Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
];
