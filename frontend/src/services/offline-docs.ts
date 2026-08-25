/**
 * Offline statement, receipt, and transactions export.
 *
 * Generates HSBC-styled HTML/CSV documents fully on-device. On web the file
 * is downloaded via a Blob URL. On native it's written to the documents
 * directory and shared via expo-sharing.
 */
import { Platform } from 'react-native';
// Expo SDK 54 replaced the top-level expo-file-system API with a new
// File/Directory class-based API. The legacy async helpers (getInfoAsync,
// moveAsync, documentDirectory constant) are still supported but must be
// imported from the /legacy sub-path — otherwise every call throws
// "Method getInfoAsync imported from expo-file-system is deprecated".
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb, Transaction } from './offline-store';
import { getBankTheme } from '../context/BankThemes';
import { userScopedKey } from './user-scope';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Resolve the currently-active bank so PDFs are branded per theme.
 *  Must read the *user-scoped* customization key so switching profiles
 *  does not leak another user's theme into the generated PDF. */
async function getActiveBank(): Promise<{ id: string; name: string; primary: string; shortId: string }> {
  try {
    // Per-user customization key (e.g. "hsbc_customization::userId")
    const key = await userScopedKey('hsbc_customization');
    // Try user-scoped first; fall back to the legacy global key so
    // pre-multi-user installations still find their theme.
    const raw = (await AsyncStorage.getItem(key)) || (await AsyncStorage.getItem('hsbc_customization'));
    if (raw) {
      const parsed = JSON.parse(raw);
      const themeId = parsed?.bankThemeId || 'hsbc';
      const theme = getBankTheme(themeId);
      return {
        id: themeId,
        name: theme.name,
        primary: theme.colors.primary,
        shortId: themeId.toUpperCase(),
      };
    }
  } catch {
    /* ignore */
  }
  const hsbc = getBankTheme('hsbc');
  return { id: 'hsbc', name: hsbc.name, primary: hsbc.colors.primary, shortId: 'HSBC' };
}

/** Build a themed header + STYLES block. */
function themedAssets(bank: { name: string; primary: string }) {
  return {
    header: `
      <div class="bank-bar">
        <div class="hex"></div>
        <div class="brand">${bank.name}</div>
      </div>
    `,
    styles: `<style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0B1424; margin: 0; padding: 0; background: #ffffff; }
      .page { max-width: 720px; margin: 0 auto; padding: 36px 40px; }
      .bank-bar { display: flex; align-items: center; border-bottom: 3px solid ${bank.primary}; padding-bottom: 12px; margin-bottom: 24px; }
      .hex { width: 28px; height: 28px; background: ${bank.primary}; clip-path: polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%); margin-right: 12px; }
      .brand { font-size: 22px; font-weight: 800; color: ${bank.primary}; letter-spacing: 1.5px; }
      h1 { font-size: 24px; margin: 0 0 4px; color: #0B1424; }
      .sub { font-size: 13px; color: #5E6A7A; margin-bottom: 24px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
      .meta .label { font-size: 11px; color: #8893A3; text-transform: uppercase; letter-spacing: 0.7px; }
      .meta .val { font-size: 14px; font-weight: 600; color: #0B1424; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { text-align: left; font-size: 11px; text-transform: uppercase; color: #8893A3; padding: 8px 4px; border-bottom: 1px solid #E4E7EB; }
      td { padding: 10px 4px; border-bottom: 1px solid #F0F2F5; font-size: 13px; }
      td.right, th.right { text-align: right; }
      .amt-in { color: #00847F; font-weight: 600; }
      .amt-out { color: #0B1424; font-weight: 600; }
      .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; padding: 16px; background: #F7F8FA; border-radius: 6px; margin-bottom: 20px; }
      .summary .lbl { font-size: 11px; color: #8893A3; text-transform: uppercase; letter-spacing: 0.6px; }
      .summary .amt { font-size: 16px; font-weight: 700; margin-top: 4px; }
      .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E4E7EB; font-size: 10px; color: #8893A3; line-height: 1.6; }
      .receipt-card { padding: 20px; background: #F7F8FA; border-radius: 6px; margin-bottom: 16px; }
      .receipt-amt { font-size: 32px; font-weight: 800; color: #0B1424; text-align: center; margin: 12px 0 4px; }
      .receipt-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #E4E7EB; }
      .receipt-row:last-child { border-bottom: none; }
      .receipt-row .k { color: #8893A3; font-size: 12px; }
      .receipt-row .v { color: #0B1424; font-size: 13px; font-weight: 600; }
    </style>`,
  };
}

function fmtGBP(v: number) {
  return `£${v.toFixed(2)}`;
}

function fmtDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// -----------------------------------------------------------------------------
// Bank-themed HTML helpers — the header + stylesheet are computed at render
// time so the PDF matches whichever bank theme the user has active.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Statement HTML
// -----------------------------------------------------------------------------
async function buildStatementHtml(year: number, monthIdx1: number): Promise<string> {
  const db = await getDb();
  const bank = await getActiveBank();
  const { header: HEADER_HTML, styles: STYLES } = themedAssets(bank);
  const first = new Date(year, monthIdx1 - 1, 1);
  const last = new Date(year, monthIdx1, 0);

  const txns = db.transactions
    .filter((t) => {
      const ts = new Date(t.timestamp);
      return ts >= first && ts <= new Date(year, monthIdx1, 0, 23, 59, 59);
    })
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

  const credits = txns.filter((t) => t.transaction_type === 'deposit');
  const debits = txns.filter((t) => t.transaction_type !== 'deposit');
  const totalCredits = credits.reduce((s, t) => s + t.amount, 0);
  const totalDebits = debits.reduce((s, t) => s + t.amount, 0);

  const checking = db.accounts.find((a) => a.account_type === 'checking');
  const periodLabel = `${MONTHS[monthIdx1 - 1]} ${year}`;

  const rows = txns
    .map((t) => {
      const isDeposit = t.transaction_type === 'deposit';
      return `<tr>
        <td>${fmtDate(t.timestamp)}</td>
        <td>${escapeHtml(t.description)}<div style="color:#8893A3;font-size:11px;margin-top:2px">${escapeHtml(t.recipient_name || '')}${t.reference ? ` · Ref ${escapeHtml(t.reference)}` : ''}</div></td>
        <td class="right ${isDeposit ? 'pos' : 'neg'}">${isDeposit ? '+' : '−'} ${fmtGBP(t.amount)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${bank.name} Statement — ${periodLabel}</title>${STYLES}</head>
  <body><div class="page">
    ${HEADER_HTML}
    <h1>Monthly Statement</h1>
    <div class="sub">${periodLabel} · Account ${checking?.sort_code || '--'} ${checking?.account_number || '--'}</div>
    <div class="meta">
      <div><div class="label">Account holder</div><div class="val">${escapeHtml(db.profile.name)}</div></div>
      <div><div class="label">Address</div><div class="val">${escapeHtml(db.profile.address)}</div></div>
      <div><div class="label">Sort code</div><div class="val">${escapeHtml(checking?.sort_code || '--')}</div></div>
      <div><div class="label">Account number</div><div class="val">${escapeHtml(checking?.account_number || '--')}</div></div>
      <div><div class="label">Email</div><div class="val">${escapeHtml(db.profile.email || '—')}</div></div>
      <div><div class="label">Phone</div><div class="val">${escapeHtml(db.profile.phone || '—')}</div></div>
      <div><div class="label">Statement period</div><div class="val">${fmtDate(first.toISOString())} – ${fmtDate(last.toISOString())}</div></div>
      <div><div class="label">Currency</div><div class="val">GBP (£)</div></div>
    </div>
    <div class="summary">
      <div><div class="lbl">Money in</div><div class="amt" style="color:#00847F">${fmtGBP(totalCredits)}</div></div>
      <div><div class="lbl">Money out</div><div class="amt">${fmtGBP(totalDebits)}</div></div>
      <div><div class="lbl">Closing balance</div><div class="amt">${fmtGBP(checking?.balance || 0)}</div></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th class="right">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3" style="text-align:center;color:#8893A3;padding:24px 0">No transactions in this period</td></tr>'}</tbody>
    </table>
    <div class="footer">
      <strong>${bank.name} Bank plc.</strong> Electronic statement generated on ${fmtDateTime(new Date().toISOString())}.<br/>
      This document is an accurate reflection of the transactions on your account for the period shown.<br/>
      For queries please contact your ${bank.name} branch or call the customer-services line printed in the app.
    </div>
  </div></body></html>`;
}

// -----------------------------------------------------------------------------
// Receipt HTML
// -----------------------------------------------------------------------------
async function buildReceiptHtml(t: Transaction, holderName: string): Promise<string> {
  const bank = await getActiveBank();
  const { header: HEADER_HTML, styles: STYLES } = themedAssets(bank);
  const db = await getDb();
  const checking = db.accounts.find((a) => a.account_type === 'checking');
  const isDeposit = t.transaction_type === 'deposit';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>${STYLES}</head>
  <body><div class="page">
    ${HEADER_HTML}
    <h1>Transaction Receipt</h1>
    <div class="sub">Generated ${fmtDateTime(new Date().toISOString())}</div>
    <div class="meta">
      <div><div class="label">Account holder</div><div class="val">${escapeHtml(holderName)}</div></div>
      <div><div class="label">Address</div><div class="val">${escapeHtml(db.profile.address)}</div></div>
      <div><div class="label">Sort code</div><div class="val">${escapeHtml(checking?.sort_code || '--')}</div></div>
      <div><div class="label">Account number</div><div class="val">${escapeHtml(checking?.account_number || '--')}</div></div>
    </div>
    <div class="receipt-card">
      <div class="receipt-amt">${isDeposit ? '+' : '−'} ${fmtGBP(t.amount)}</div>
      <div class="receipt-row"><span class="k">Status</span><span class="v" style="color:#00847F">${escapeHtml(t.status)}</span></div>
      <div class="receipt-row"><span class="k">Description</span><span class="v">${escapeHtml(t.description)}</span></div>
      <div class="receipt-row"><span class="k">${isDeposit ? 'From' : 'To'}</span><span class="v">${escapeHtml(t.recipient_name || '—')}</span></div>
      ${t.recipient_sort_code ? `<div class="receipt-row"><span class="k">Sort code</span><span class="v">${escapeHtml(t.recipient_sort_code)}</span></div>` : ''}
      ${t.recipient_account_number ? `<div class="receipt-row"><span class="k">Account</span><span class="v">${escapeHtml(t.recipient_account_number)}</span></div>` : ''}
      <div class="receipt-row"><span class="k">Date</span><span class="v">${fmtDateTime(t.timestamp)}</span></div>
      ${t.reference ? `<div class="receipt-row"><span class="k">Reference</span><span class="v">${escapeHtml(t.reference)}</span></div>` : ''}
      ${t.trn ? `<div class="receipt-row"><span class="k">TRN</span><span class="v">${escapeHtml(t.trn)}</span></div>` : ''}
      ${t.fpid ? `<div class="receipt-row"><span class="k">FPID</span><span class="v">${escapeHtml(t.fpid)}</span></div>` : ''}
    </div>
    <div class="footer">${bank.name} · Digital receipt. Please retain for your records.</div>
  </div></body></html>`;
}

// -----------------------------------------------------------------------------
// CSV
// -----------------------------------------------------------------------------
function buildCsv(txns: Transaction[]): string {
  const rows = [['Date', 'Description', 'Counterparty', 'Reference', 'Type', 'Amount (GBP)']];
  txns.forEach((t) => {
    rows.push([
      fmtDate(t.timestamp),
      t.description,
      t.recipient_name || '',
      t.reference || '',
      t.transaction_type,
      `${t.transaction_type === 'deposit' ? '+' : '-'}${t.amount.toFixed(2)}`,
    ]);
  });
  return rows
    .map((r) => r.map((c) => `"${(c || '').toString().replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

// -----------------------------------------------------------------------------
// Public exports (download / share helpers)
// -----------------------------------------------------------------------------
/**
 * Deliver an HTML document as a real PDF.
 *
 * - Native: use `expo-print` to render the HTML to a PDF file on disk,
 *   then open the share sheet so the user can save / send it.
 * - Web: use `expo-print.printAsync` which opens the browser print dialog
 *   (Chrome / Safari let the user choose "Save as PDF" or print directly).
 *
 * If for any reason PDF rendering fails on web, fall back to a Blob HTML
 * download so the user still ends up with the document.
 */
async function deliverPdf(filename: string, html: string) {
  if (Platform.OS === 'web') {
    // 1) On mobile browsers (Chrome Android / Safari iOS 16.4+), the Web
    //    Share API v2 can share files including PDFs — that gives the user
    //    a real "Share to WhatsApp / Mail / Messages" sheet without any
    //    extra install. We try this path first.
    try {
      const anyNav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (anyNav?.canShare && anyNav?.share) {
        // Render HTML → PDF blob via a hidden iframe + print-to-blob is
        // not universally supported; instead we ship the HTML file itself
        // renamed as .html so WhatsApp / Mail accepts it as an attachment.
        // This works on every browser that supports Web Share API v2.
        const htmlBlob = new Blob([html], { type: 'text/html' });
        const htmlFile = new File([htmlBlob], filename.replace(/\.pdf$/i, '.html'), {
          type: 'text/html',
        });
        if (anyNav.canShare({ files: [htmlFile] })) {
          try {
            await anyNav.share({
              title: filename,
              text: 'Bank statement / receipt from your mobile banking app.',
              files: [htmlFile],
            });
            return;
          } catch (e: any) {
            // User cancelled the share sheet — that is not an error.
            if (e?.name === 'AbortError') return;
            // Fall through to print / download fallbacks below.
          }
        }
      }
    } catch {
      /* fall through */
    }
    // 2) Fall back to the browser's native print dialog — user can pick
    //    "Save as PDF" and then attach the file manually to any app.
    try {
      await Print.printAsync({ html });
      return;
    } catch {
      // 3) Last-resort HTML download so the user still gets the file.
      try {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.replace(/\.pdf$/i, '.html');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        /* ignore */
      }
      return;
    }
  }

  // Native (iOS / Android): render to PDF then share the file.
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  // Rename the file so the share sheet shows the bank-branded filename
  const desired = `${FileSystem.documentDirectory}${filename}`;
  try {
    await FileSystem.moveAsync({ from: uri, to: desired });
  } catch {
    // If move fails (e.g. file exists), just share the original tmp uri.
  }
  const finalUri = (await FileSystem.getInfoAsync(desired)).exists ? desired : uri;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(finalUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Share ${filename}`,
    });
  }
}

/** CSV is a plain text file — keep the original Blob/FileSystem path. */
async function deliverCsv(filename: string, csv: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }
  const uri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: filename });
  }
}

export async function downloadMonthlyStatement(year: number, monthIdx1: number) {
  const bank = await getActiveBank();
  const html = await buildStatementHtml(year, monthIdx1);
  await deliverPdf(
    `${bank.shortId}_Statement_${year}_${String(monthIdx1).padStart(2, '0')}.pdf`,
    html,
  );
}

export async function downloadReceipt(txn: Transaction) {
  const db = await getDb();
  const bank = await getActiveBank();
  const html = await buildReceiptHtml(txn, db.profile.name);
  await deliverPdf(`${bank.shortId}_Receipt_${txn.id}.pdf`, html);
}

export async function downloadTransactionsExport(format: 'csv' | 'pdf' | 'html') {
  const db = await getDb();
  const bank = await getActiveBank();
  const txns = [...db.transactions].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  if (format === 'csv') {
    await deliverCsv(`${bank.shortId}_Transactions_${Date.now()}.csv`, buildCsv(txns));
    return;
  }
  // pdf or html → render the styled HTML to PDF
  const html = await buildStatementHtml(new Date().getFullYear(), new Date().getMonth() + 1);
  await deliverPdf(`${bank.shortId}_Transactions_${Date.now()}.pdf`, html);
}
