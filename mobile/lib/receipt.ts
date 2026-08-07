import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { dateTimeOf } from './format';
import { formatAmount } from './money';
import type { TransferDetail } from './types';
import { STATUS_LABEL } from './format';

/**
 * Renders a receipt to PDF and hands it to the Android share sheet.
 *
 * HTML → PDF via expo-print rather than a JS PDF library: the platform's own
 * renderer handles fonts and pagination, and the output is a real PDF that a
 * bank or an accountant will accept, not an image of one.
 *
 * The values are the ones the ledger recorded, formatted but never recomputed.
 */
export async function shareReceipt(t: TransferDetail): Promise<void> {
  const html = receiptHtml(t);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Transfer receipt',
      UTI: 'com.adobe.pdf',
    });
  }
}

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

function receiptHtml(t: TransferDetail): string {
  const total = (Number(t.amount) + Number(t.feeAmount)).toFixed(2);
  const rows: [string, string][] = [
    ['Reference', t.id.slice(0, 8).toUpperCase()],
    ['Status', STATUS_LABEL[t.status]],
    ['Created', dateTimeOf(t.createdAt)],
    ['Recipient', t.recipient.name],
    ['Destination', t.recipient.country],
    ['Account', t.recipient.bankAccount],
    ['You sent', `${formatAmount(t.amount)} ${t.sendCurrency}`],
    ['Fee', `${formatAmount(t.feeAmount)} ${t.sendCurrency}`],
    ['Total charged', `${formatAmount(total)} ${t.sendCurrency}`],
    ['Exchange rate', t.fxRateApplied ? `1 ${t.sendCurrency} = ${formatAmount(t.fxRateApplied, 4)} ${t.receiveCurrency}` : '—'],
    ['They receive', t.receiveAmount ? `${formatAmount(t.receiveAmount)} ${t.receiveCurrency}` : '—'],
  ];

  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { margin: 40px; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #121714; font-size: 13px; }
  .head { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #121714; padding-bottom: 14px; }
  .mark { width: 30px; height: 30px; }
  h1 { font-size: 21px; margin: 0; letter-spacing: -.5px; }
  .sub { color: #5B635B; font-size: 11px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 22px; }
  td { padding: 9px 0; border-bottom: 1px solid #E3E6DE; vertical-align: top; }
  td.k { color: #5B635B; width: 42%; }
  td.v { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  tr.total td { border-bottom: 2px solid #121714; font-size: 15px; }
  h2 { font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; color: #5B635B; margin: 26px 0 8px; }
  .ev { padding: 6px 0; border-bottom: 1px solid #F1F3EE; display: flex; justify-content: space-between; }
  .ev span:last-child { color: #676E66; }
  footer { margin-top: 30px; color: #676E66; font-size: 10.5px; line-height: 1.6; }
</style></head><body>
  <div class="head">
    <svg class="mark" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="15" fill="none" stroke="#E0B259" stroke-width="1.4"/>
      <path d="M 11 11 L 13 8 L 14 13 L 18 13 L 19 8 L 21 11 Q 23 16 21 20 Q 16 23 11 20 Q 9 16 11 11 Z" fill="#E0B259"/>
      <circle cx="13.6" cy="15" r=".9" fill="#121714"/><circle cx="18.4" cy="15" r=".9" fill="#121714"/>
    </svg>
    <div>
      <h1>Transfer receipt</h1>
      <div class="sub">Meow · issued ${esc(dateTimeOf(new Date().toISOString()))}</div>
    </div>
  </div>

  <table>
    ${rows
      .map(
        ([k, v], i) =>
          `<tr class="${k === 'Total charged' ? 'total' : ''}"><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`,
      )
      .join('')}
  </table>

  <h2>Timeline</h2>
  ${t.timeline
    .map(
      (e) =>
        `<div class="ev"><span>${esc(e.message || STATUS_LABEL[e.status])}</span><span>${esc(dateTimeOf(e.createdAt))}</span></div>`,
    )
    .join('')}

  <footer>
    This receipt reflects the ledger entries recorded for this transfer. The exchange rate shown is
    the rate applied at the time of conversion, inclusive of margin. The fee is charged separately
    from the amount sent.
  </footer>
</body></html>`;
}
