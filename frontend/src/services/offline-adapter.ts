/**
 * Offline axios adapter.
 *
 * Replaces the normal HTTP adapter. Every axios request issued through `api`
 * is routed here and dispatched to a local handler that reads/writes the
 * AsyncStorage-backed offline store. No network is ever touched.
 *
 * To keep the call sites unchanged, each handler returns plain data and the
 * adapter wraps it into an axios-compatible response.
 */
import type { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import {
  getDb,
  persist,
  newId,
  addTransaction,
  addNotification,
  FX_RATES_GBP,
  FX_CURRENCIES,
  classifyTxn,
  getBudgets,
  setBudgetLimit,
  monthlySpendByCategory,
  checkBudgetAlerts,
  BUDGET_CATEGORIES,
  runDueSchedules,
} from './offline-store';
import { sendTransactionNotification, formatGBP } from './notifications';

// -----------------------------------------------------------------------------
// Live FX rate refresh (best-effort, optional)
// -----------------------------------------------------------------------------
// Cache the live GBP-base rate table in-memory for the session. open.er-api.com
// is a free public endpoint that returns rates relative to a chosen base.
// If the network is unreachable we silently fall back to the static table.
let liveRatesCache: Record<string, number> | null = null;
let liveRatesFetchedAt = 0;
const LIVE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function fetchLiveRatesIfStale(): Promise<Record<string, number> | null> {
  const now = Date.now();
  if (liveRatesCache && now - liveRatesFetchedAt < LIVE_TTL_MS) return liveRatesCache;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch('https://open.er-api.com/v6/latest/GBP', {
      signal: controller.signal as any,
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const json: any = await resp.json();
    if (json && json.rates && typeof json.rates === 'object') {
      // Override only the currencies we know about so we don't blow up the table
      const table: Record<string, number> = { ...FX_RATES_GBP };
      Object.keys(table).forEach((k) => {
        if (typeof json.rates[k] === 'number') table[k] = json.rates[k];
      });
      liveRatesCache = table;
      liveRatesFetchedAt = now;
      return table;
    }
    return null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Scheduled deposits — auto-execute due schedules and notify the user
// -----------------------------------------------------------------------------
let lastSchedulesRunAt = 0;
const SCHEDULES_THROTTLE_MS = 4000; // don't re-run more than once every 4s

async function runSchedulesAndNotify(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSchedulesRunAt < SCHEDULES_THROTTLE_MS) return;
  lastSchedulesRunAt = now;
  try {
    const outcomes = await runDueSchedules();
    if (outcomes.length === 0) return;
    const db = await getDb();
    for (const o of outcomes) {
      const acct = db.accounts.find((a) => a.id === o.account_id);
      const totalAdded = +(o.amount * o.runs_executed).toFixed(2);
      const summary =
        o.runs_executed > 1
          ? `${o.runs_executed} scheduled deposits of ${formatGBP(o.amount)} from ${o.source} (${formatGBP(totalAdded)} total)`
          : `${formatGBP(o.amount)} from ${o.source} added to ${acct?.account_type === 'checking' ? 'Current' : 'Savings'} Account`;
      void sendTransactionNotification({
        title: 'Scheduled deposit received',
        body: summary,
        data: { type: 'schedule', schedule_id: o.schedule_id },
      });
      await addNotification({
        user_id: db.profile.id,
        title: 'Scheduled deposit received',
        body: summary,
        notification_type: 'schedule',
        is_read: false,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('runSchedulesAndNotify failed', e);
  }
}

// -----------------------------------------------------------------------------
// Budget alert helper
// -----------------------------------------------------------------------------
async function fireBudgetAlertsFor(transactionType: string) {
  try {
    const cat = classifyTxn(transactionType);
    const alerts = await checkBudgetAlerts(cat);
    for (const a of alerts) {
      sendTransactionNotification({
        title: a.level === 100 ? `Budget exceeded · ${a.category}` : `Budget alert · ${a.category}`,
        body:
          a.level === 100
            ? `You've spent ${formatGBP(a.spent)} of your ${formatGBP(a.limit)} ${a.category} budget this month.`
            : `You've used 80% of your ${a.category} budget — ${formatGBP(a.spent)} of ${formatGBP(a.limit)}.`,
        data: { type: 'budget', category: a.category },
      });
      await addNotification({
        user_id: (await getDb()).profile.id,
        title: a.level === 100 ? `Budget exceeded · ${a.category}` : `Budget alert · ${a.category}`,
        body: `${formatGBP(a.spent)} / ${formatGBP(a.limit)}`,
        notification_type: 'budget',
        is_read: false,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('budget alert check failed', e);
  }
}

// Small helper for crafting the response axios expects.
function ok<T>(data: T, config: InternalAxiosRequestConfig): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {} as any,
    config,
    request: null,
  };
}

function err(status: number, detail: string) {
  const e: any = new Error(detail);
  e.response = { status, data: { detail } };
  e.code = `E${status}`;
  return e;
}

// Parse URL into path + query map
function parseUrl(url: string): { path: string; query: Record<string, string> } {
  const [path, qs = ''] = url.split('?');
  const query: Record<string, string> = {};
  qs.split('&')
    .filter(Boolean)
    .forEach((pair) => {
      const [k, v] = pair.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  return { path, query };
}

// Small artificial delay so the UX feels responsive but not "instant fake"
function microDelay(ms = 220) {
  return new Promise((r) => setTimeout(r, ms));
}

// -----------------------------------------------------------------------------
// Route handlers
// -----------------------------------------------------------------------------
type Ctx = {
  method: string;
  path: string;
  query: Record<string, string>;
  body: any;
  config: InternalAxiosRequestConfig;
};

async function handle(ctx: Ctx): Promise<AxiosResponse> {
  const { method, path, query, body, config } = ctx;
  const db = await getDb();

  // Lazy background tick — every API call drains any due schedules. The
  // helper is throttled internally so this is effectively free except on
  // the first call after a long absence.
  await runSchedulesAndNotify();

  // ---- Auth -----------------------------------------------------------------
  if (path === '/auth/passcode' && method === 'POST') {
    const code = (body?.passcode || '').toString();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      throw err(401, 'Passcode must be 4 digits');
    }
    return ok(
      {
        access_token: `offline.${newId()}`,
        token_type: 'bearer',
        user: { id: db.profile.id, email: db.profile.email, name: db.profile.name },
      },
      config,
    );
  }

  if (path === '/auth/login' && method === 'POST') {
    return ok(
      {
        access_token: `offline.${newId()}`,
        token_type: 'bearer',
        user: { id: db.profile.id, email: db.profile.email, name: db.profile.name },
      },
      config,
    );
  }

  if (path === '/auth/register' && method === 'POST') {
    db.profile.name = body?.name || db.profile.name;
    db.profile.email = body?.email || db.profile.email;
    await persist();
    return ok(
      {
        access_token: `offline.${newId()}`,
        token_type: 'bearer',
        user: { id: db.profile.id, email: db.profile.email, name: db.profile.name },
      },
      config,
    );
  }

  // ---- Profile --------------------------------------------------------------
  if (path === '/profile' && method === 'GET') {
    return ok(db.profile, config);
  }
  if (path === '/profile' && method === 'PUT') {
    db.profile = {
      ...db.profile,
      name: body?.name ?? db.profile.name,
      email: body?.email ?? db.profile.email,
      phone: body?.phone ?? db.profile.phone,
      address: body?.address ?? db.profile.address,
    };
    await persist();
    return ok(db.profile, config);
  }

  // ---- Accounts -------------------------------------------------------------
  if (path === '/accounts' && method === 'GET') return ok(db.accounts, config);
  const acctById = path.match(/^\/accounts\/([^/]+)$/);
  if (acctById && method === 'GET') {
    const acct = db.accounts.find((a) => a.id === acctById[1]);
    if (!acct) throw err(404, 'Account not found');
    return ok(acct, config);
  }
  if (path === '/accounts/details' && method === 'PUT') {
    const a = db.accounts.find((x) => x.id === body.account_id);
    if (!a) throw err(404, 'Account not found');
    if (body.sort_code) a.sort_code = body.sort_code;
    if (body.account_number) a.account_number = body.account_number;
    await persist();
    return ok(a, config);
  }

  // ---- Transactions ---------------------------------------------------------
  if (path === '/transactions' && method === 'GET') {
    let list = [...db.transactions].sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : -1,
    );
    if (query.filter_type === 'sent') {
      list = list.filter((t) => t.from_account_id && !t.to_account_id);
    } else if (query.filter_type === 'received') {
      list = list.filter((t) => t.to_account_id && !t.from_account_id);
    }
    if (query.limit) list = list.slice(0, parseInt(query.limit, 10));
    return ok(list, config);
  }
  const txnById = path.match(/^\/transactions\/([^/]+)$/);
  if (txnById && method === 'GET') {
    const t = db.transactions.find((x) => x.id === txnById[1]);
    if (!t) throw err(404, 'Transaction not found');
    return ok(t, config);
  }
  if (txnById && method === 'DELETE') {
    const i = db.transactions.findIndex((x) => x.id === txnById[1]);
    if (i < 0) throw err(404, 'Transaction not found');
    db.transactions.splice(i, 1);
    await persist();
    return ok({ message: 'Transaction deleted' }, config);
  }

  // ---- Transfers (domestic) -------------------------------------------------
  if (path === '/transfers' && method === 'POST') {
    await microDelay(600);
    const from = db.accounts.find((a) => a.id === body.from_account_id);
    if (!from) throw err(404, 'Source account not found');
    const amt = Number(body.amount);
    if (!amt || amt <= 0) throw err(400, 'Invalid amount');
    if (from.balance < amt) throw err(400, 'Insufficient funds');
    from.balance = +(from.balance - amt).toFixed(2);

    const txn = await addTransaction({
      user_id: db.profile.id,
      from_account_id: from.id,
      amount: amt,
      transaction_type: 'transfer',
      description: body.description || `Transfer to ${body.recipient_name || body.to_account_number}`,
      recipient_name: body.recipient_name,
      recipient_account_number: body.to_account_number,
      recipient_sort_code: body.sort_code,
      reference: `REF${Math.floor(Math.random() * 1e6)}`,
      trn: `TRN${(Math.floor(Math.random() * 1e10)).toString().padStart(10, '0')}`,
      fpid: `FP${(Math.floor(Math.random() * 1e12)).toString().padStart(12, '0')}`,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });
    await addNotification({
      user_id: db.profile.id,
      title: 'Transfer sent',
      body: `£${amt.toFixed(2)} sent to ${body.recipient_name || body.to_account_number}`,
      notification_type: 'transfer',
      is_read: false,
      timestamp: new Date().toISOString(),
    });
    await persist();
    // Fire-and-forget: never block the API response on notifications.
    void sendTransactionNotification({
      title: 'Payment sent',
      body: `${formatGBP(amt)} to ${body.recipient_name || body.to_account_number}`,
      data: { txn_id: txn.id },
    });
    void fireBudgetAlertsFor('transfer');
    return ok(txn, config);
  }

  // ---- International transfer ----------------------------------------------
  if (path === '/transfers/international' && method === 'POST') {
    await microDelay(900);
    const from = db.accounts.find((a) => a.id === body.from_account_id);
    if (!from) throw err(404, 'Source account not found');
    const amt = Number(body.amount);
    if (!amt || amt <= 0) throw err(400, 'Invalid amount');
    if (from.balance < amt) throw err(400, 'Insufficient funds');
    from.balance = +(from.balance - amt).toFixed(2);

    const rate = FX_RATES_GBP[body.target_currency] ?? 1;
    const converted = +(amt * rate).toFixed(2);

    const txn = await addTransaction({
      user_id: db.profile.id,
      from_account_id: from.id,
      amount: amt,
      transaction_type: 'transfer',
      description: `International transfer to ${body.recipient_name} (${body.target_currency} ${converted.toFixed(2)})`,
      recipient_name: body.recipient_name,
      recipient_account_number: body.iban || body.account_number,
      recipient_bank_name: body.bank_name,
      reference: `INT${Math.floor(Math.random() * 1e6)}`,
      trn: `TRN${(Math.floor(Math.random() * 1e10)).toString().padStart(10, '0')}`,
      fpid: `SWIFT${(Math.floor(Math.random() * 1e10)).toString().padStart(10, '0')}`,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });
    await persist();
    void sendTransactionNotification({
      title: 'International transfer sent',
      body: `${formatGBP(amt)} → ${body.target_currency} ${converted.toFixed(2)} to ${body.recipient_name}`,
      data: { txn_id: txn.id },
    });
    void fireBudgetAlertsFor('transfer');
    return ok({ ...txn, converted_amount: converted, rate }, config);
  }

  // ---- Budgets -------------------------------------------------------------
  if (path === '/budgets' && method === 'GET') {
    const budgets = await getBudgets();
    const spent = await monthlySpendByCategory();
    const data = BUDGET_CATEGORIES.map((cat) => {
      const slot = budgets.categories[cat] || { limit: 0, alerted80: false, alerted100: false };
      return {
        category: cat,
        limit: slot.limit,
        spent: +(spent[cat] || 0).toFixed(2),
        percent: slot.limit > 0 ? Math.min(100, +(((spent[cat] || 0) / slot.limit) * 100).toFixed(1)) : 0,
      };
    });
    return ok({ month: budgets.month, items: data }, config);
  }
  if (path === '/budgets' && method === 'PUT') {
    const cat = body?.category;
    const limit = parseFloat(body?.limit || '0');
    if (!cat) throw err(400, 'category required');
    await setBudgetLimit(cat, limit);
    return ok({ message: 'Budget updated' }, config);
  }

  // ---- FX -------------------------------------------------------------------
  if (path === '/fx/currencies' && method === 'GET') {
    return ok(FX_CURRENCIES, config);
  }
  if (path === '/fx/rate' && method === 'GET') {
    const fromCcy = (query.from_ccy || 'GBP').toUpperCase();
    const toCcy = (query.to_ccy || 'GBP').toUpperCase();
    const amount = parseFloat(query.amount || '1');

    // 1) Try to refresh live rates from open.er-api.com (silent on failure).
    //    The result is cached for 6 hours so we don't spam the API.
    const live = await fetchLiveRatesIfStale().catch(() => null);
    const table = live || FX_RATES_GBP;

    const fromRate = table[fromCcy] ?? FX_RATES_GBP[fromCcy] ?? 1;
    const toRate = table[toCcy] ?? FX_RATES_GBP[toCcy] ?? 1;
    const rate = toRate / fromRate;
    return ok(
      {
        from: fromCcy,
        to: toCcy,
        rate,
        amount,
        converted: +(amount * rate).toFixed(4),
        live: !!live,
      },
      config,
    );
  }

  // ---- Cards ---------------------------------------------------------------
  if (path === '/cards' && method === 'GET') return ok(db.cards, config);
  const cardMatch = path.match(/^\/cards\/([^/]+)(\/freeze|\/unfreeze)?$/);
  if (cardMatch) {
    const card = db.cards.find((c) => c.id === cardMatch[1]);
    if (!card) throw err(404, 'Card not found');
    if (cardMatch[2] === '/freeze' && method === 'POST') {
      card.is_frozen = true;
      await persist();
      return ok({ message: 'Card frozen', is_frozen: true }, config);
    }
    if (cardMatch[2] === '/unfreeze' && method === 'POST') {
      card.is_frozen = false;
      await persist();
      return ok({ message: 'Card unfrozen', is_frozen: false }, config);
    }
    if (!cardMatch[2] && method === 'PUT') {
      if (body.card_name) card.card_name = body.card_name;
      if (body.card_number) {
        card.card_number = body.card_number.replace(/\s/g, '');
        card.card_number_masked = `**** **** **** ${card.card_number.slice(-4)}`;
      }
      if (body.expiry_date) card.expiry_date = body.expiry_date;
      await persist();
      return ok(card, config);
    }
  }

  // ---- Dashboard -----------------------------------------------------------
  if (path === '/dashboard/stats' && method === 'GET') {
    const totalBalance = db.accounts.reduce((s, a) => s + a.balance, 0);
    const now = new Date();
    const monthlySpending = db.transactions
      .filter((t) => {
        if (t.transaction_type === 'deposit') return false;
        const ts = new Date(t.timestamp);
        return ts.getMonth() === now.getMonth() && ts.getFullYear() === now.getFullYear();
      })
      .reduce((s, t) => s + t.amount, 0);
    const recent = [...db.transactions]
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, 5);
    return ok(
      {
        total_balance: +totalBalance.toFixed(2),
        monthly_spending: +monthlySpending.toFixed(2),
        accounts_count: db.accounts.length,
        recent_transactions: recent,
      },
      config,
    );
  }

  // ---- Payees --------------------------------------------------------------
  if (path === '/payees' && method === 'GET') return ok(db.payees, config);
  if (path === '/payees' && method === 'POST') {
    const p = {
      id: newId(),
      user_id: db.profile.id,
      name: body.name,
      sort_code: body.sort_code,
      account_number: body.account_number,
      last_used: new Date().toISOString(),
    };
    db.payees.unshift(p);
    await persist();
    return ok(p, config);
  }
  const payeeIdM = path.match(/^\/payees\/([^/]+)$/);
  if (payeeIdM && method === 'PUT') {
    const p = db.payees.find((x) => x.id === payeeIdM[1]);
    if (!p) throw err(404, 'Payee not found');
    Object.assign(p, body);
    await persist();
    return ok(p, config);
  }
  if (payeeIdM && method === 'DELETE') {
    const i = db.payees.findIndex((x) => x.id === payeeIdM[1]);
    if (i < 0) throw err(404, 'Payee not found');
    db.payees.splice(i, 1);
    await persist();
    return ok({ message: 'Payee deleted' }, config);
  }

  // ---- Billers -------------------------------------------------------------
  if (path === '/billers' && method === 'GET') return ok(db.billers, config);
  if (path === '/bills/pay' && method === 'POST') {
    await microDelay(600);
    const from = db.accounts.find((a) => a.id === body.from_account_id);
    if (!from) throw err(404, 'Source account not found');
    const biller = db.billers.find((b) => b.id === body.biller_id);
    if (!biller) throw err(404, 'Biller not found');
    const amt = Number(body.amount);
    if (from.balance < amt) throw err(400, 'Insufficient funds');
    from.balance = +(from.balance - amt).toFixed(2);
    const txn = await addTransaction({
      user_id: db.profile.id,
      from_account_id: from.id,
      amount: amt,
      transaction_type: 'payment',
      description: `Bill payment - ${biller.name}`,
      recipient_name: biller.name,
      reference: body.reference || `BILL${Math.floor(Math.random() * 1e6)}`,
      trn: `TRN${(Math.floor(Math.random() * 1e10)).toString().padStart(10, '0')}`,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });
    await persist();
    void sendTransactionNotification({
      title: 'Bill paid',
      body: `${formatGBP(amt)} paid to ${biller.name}`,
      data: { txn_id: txn.id },
    });
    void fireBudgetAlertsFor('payment');
    return ok(txn, config);
  }

  // ---- Deposits (Add Money / Incoming Transfer) ---------------------------
  if (path === '/deposits' && method === 'POST') {
    await microDelay(500);
    const acct = db.accounts.find((a) => a.id === body.account_id);
    if (!acct) throw err(404, 'Account not found');
    const amt = Number(body.amount);
    if (!amt || amt <= 0) throw err(400, 'Invalid amount');
    acct.balance = +(acct.balance + amt).toFixed(2);

    // Incoming transfers carry sender details so the receipt looks just
    // like a real Faster Payment credit on a UK bank statement.
    const senderName = body.sender_name || body.source || 'Bank Transfer Deposit';
    const senderSort = body.sender_sort_code || undefined;
    const senderAccount = body.sender_account_number || undefined;
    const description = body.description ||
      (senderSort ? `Incoming transfer from ${senderName}` : `Deposit from ${body.source}`);

    const txn = await addTransaction({
      user_id: db.profile.id,
      to_account_id: acct.id,
      amount: amt,
      transaction_type: 'deposit',
      description,
      recipient_name: senderName,
      recipient_sort_code: senderSort,
      recipient_account_number: senderAccount,
      reference: body.reference || `DEP${Math.floor(Math.random() * 1e6)}`,
      trn: `TRN${(Math.floor(Math.random() * 1e10)).toString().padStart(10, '0')}`,
      fpid: `FP${(Math.floor(Math.random() * 1e12)).toString().padStart(12, '0')}`,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });
    await persist();
    void sendTransactionNotification({
      title: 'Money in',
      body: senderSort
        ? `${formatGBP(amt)} received from ${senderName}`
        : `${formatGBP(amt)} added to ${acct.account_type === 'checking' ? 'Current' : 'Savings'} Account`,
      data: { txn_id: txn.id },
    });
    return ok(
      { message: 'Deposited successfully', new_balance: acct.balance, transaction_id: txn.id },
      config,
    );
  }

  // ---- Move money between own accounts ------------------------------------
  if (path === '/move-money' && method === 'POST') {
    await microDelay(500);
    const from = db.accounts.find((a) => a.id === body.from_account_id);
    const to = db.accounts.find((a) => a.id === body.to_account_id);
    if (!from || !to) throw err(404, 'Account not found');
    const amt = Number(body.amount);
    if (from.balance < amt) throw err(400, 'Insufficient funds');
    from.balance = +(from.balance - amt).toFixed(2);
    to.balance = +(to.balance + amt).toFixed(2);
    const txn = await addTransaction({
      user_id: db.profile.id,
      from_account_id: from.id,
      to_account_id: to.id,
      amount: amt,
      transaction_type: 'transfer',
      description: body.description || `Move from ${from.account_type} to ${to.account_type}`,
      recipient_name: 'Self',
      reference: `MOV${Math.floor(Math.random() * 1e6)}`,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });
    await persist();
    void sendTransactionNotification({
      title: 'Money moved',
      body: `${formatGBP(amt)} from ${from.account_type === 'checking' ? 'Current' : 'Savings'} → ${to.account_type === 'checking' ? 'Current' : 'Savings'}`,
      data: { txn_id: txn.id },
    });
    return ok(
      {
        message: 'Moved successfully',
        from_balance: from.balance,
        to_balance: to.balance,
        transaction_id: txn.id,
      },
      config,
    );
  }

  // ---- Analytics -----------------------------------------------------------
  if (path === '/analytics/spending' && method === 'GET') {
    const now = new Date();
    const monthTxns = db.transactions.filter((t) => {
      if (t.transaction_type === 'deposit') return false;
      const ts = new Date(t.timestamp);
      return ts.getMonth() === now.getMonth() && ts.getFullYear() === now.getFullYear();
    });
    const total = monthTxns.reduce((s, t) => s + t.amount, 0);

    // Categorise by transaction_type
    const cats: Record<string, { total: number; count: number }> = {};
    monthTxns.forEach((t) => {
      const name =
        t.transaction_type === 'payment'
          ? 'Bills'
          : t.transaction_type === 'transfer'
          ? 'Transfers'
          : 'Other';
      cats[name] = cats[name] || { total: 0, count: 0 };
      cats[name].total += t.amount;
      cats[name].count += 1;
    });
    const categories = Object.entries(cats).map(([name, v]) => ({
      name,
      total: +v.total.toFixed(2),
      count: v.count,
    }));

    // Top payees this month
    const payeeMap: Record<string, number> = {};
    monthTxns.forEach((t) => {
      const k = t.recipient_name || 'Unknown';
      payeeMap[k] = (payeeMap[k] || 0) + t.amount;
    });
    const top_payees = Object.entries(payeeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total: +total.toFixed(2) }));

    // 6-month trend
    const monthly_trend: Array<{ month: string; year: number; total: number; count: number }> = [];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthTotal = db.transactions
        .filter((t) => {
          if (t.transaction_type === 'deposit') return false;
          const ts = new Date(t.timestamp);
          return ts.getMonth() === d.getMonth() && ts.getFullYear() === d.getFullYear();
        })
        .reduce((s, t) => s + t.amount, 0);
      monthly_trend.push({
        month: MONTHS[d.getMonth()],
        year: d.getFullYear(),
        total: +monthTotal.toFixed(2),
        count: 0,
      });
    }

    return ok(
      {
        total_spending: +total.toFixed(2),
        transaction_count: monthTxns.length,
        categories,
        top_payees,
        monthly_trend,
      },
      config,
    );
  }

  // ---- Notifications -------------------------------------------------------
  if (path === '/notifications' && method === 'GET') {
    let list = [...db.notifications].sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : -1,
    );
    if (query.limit) list = list.slice(0, parseInt(query.limit, 10));
    return ok(list, config);
  }
  if (path === '/notifications/unread-count' && method === 'GET') {
    return ok({ count: db.notifications.filter((n) => !n.is_read).length }, config);
  }
  if (path === '/notifications/read-all' && method === 'POST') {
    db.notifications.forEach((n) => (n.is_read = true));
    await persist();
    return ok({ message: 'All marked read' }, config);
  }
  const notifM = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (notifM && method === 'POST') {
    const n = db.notifications.find((x) => x.id === notifM[1]);
    if (n) n.is_read = true;
    await persist();
    return ok({ message: 'Marked read' }, config);
  }

  // ---- Schedules -----------------------------------------------------------
  if (path === '/schedules' && method === 'GET') return ok(db.schedules, config);
  if (path === '/schedules' && method === 'POST') {
    const s = {
      id: newId(),
      user_id: db.profile.id,
      account_id: body.account_id,
      amount: Number(body.amount),
      source: body.source || 'External Bank',
      frequency: body.frequency,
      next_run: body.start_date || new Date().toISOString(),
      end_date: body.end_date || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    db.schedules.push(s);
    await persist();
    return ok(s, config);
  }
  const schedM = path.match(/^\/schedules\/([^/]+)(\/toggle)?$/);
  if (schedM) {
    const s = db.schedules.find((x) => x.id === schedM[1]);
    if (!s) throw err(404, 'Schedule not found');
    if (schedM[2] === '/toggle' && method === 'POST') {
      s.is_active = !s.is_active;
      await persist();
      return ok({ message: 'Toggled', is_active: s.is_active }, config);
    }
    if (!schedM[2] && method === 'DELETE') {
      db.schedules = db.schedules.filter((x) => x.id !== schedM[1]);
      await persist();
      return ok({ message: 'Schedule deleted' }, config);
    }
  }

  // ---- Chat (server-side history not used; client scripts the responses) ---
  if (path === '/chat' && method === 'POST') {
    return ok({ response: 'Hi! I am Ellie. (offline scripted)', session_id: 'offline' }, config);
  }
  if (path.startsWith('/chat/history') && method === 'GET') {
    return ok([], config);
  }

  // Unmatched route — surface a 404 so callers can handle gracefully.
  throw err(404, `No offline handler for ${method} ${path}`);
}

// -----------------------------------------------------------------------------
// Adapter entry point
// -----------------------------------------------------------------------------
export const offlineAdapter: AxiosAdapter = async (config) => {
  const method = (config.method || 'get').toUpperCase();
  const rawUrl = config.url || '/';
  // Strip baseURL if axios passed an absolute URL
  let url = rawUrl;
  if (config.baseURL && url.startsWith(config.baseURL)) {
    url = url.slice(config.baseURL.length);
  }
  if (!url.startsWith('/')) url = '/' + url;

  const { path, query } = parseUrl(url);
  const body = config.data
    ? typeof config.data === 'string'
      ? safeParse(config.data)
      : config.data
    : undefined;

  try {
    const res = await handle({ method, path, query, body, config });
    return res;
  } catch (e: any) {
    // axios expects rejected promise; mark it so axios surfaces it normally.
    if (!e.config) e.config = config;
    if (!e.request) e.request = null;
    return Promise.reject(e);
  }
};

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
