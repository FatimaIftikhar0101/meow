import { isNative } from './platform';

export interface ReceiptData {
  id: string;
  amount: string;
  sendCurrency: string;
  receiveAmount: string | null;
  receiveCurrency: string;
  fxRateApplied: string | null;
  status: string;
  createdAt: string;
  recipient?: { name: string; country: string; bankAccount: string };
  senderName?: string | null;
}

/**
 * Build the receipt as a real PDF.
 *
 * Drawn with jsPDF's primitives rather than rasterising the DOM
 * (html2canvas/`printJS`): the output keeps selectable, searchable text, is a
 * few KB instead of a megabyte screenshot, and renders identically regardless
 * of the device's viewport — a screenshot of a 375px-wide phone layout makes a
 * poor A4 receipt.
 *
 * Replaces `window.print()`, which silently does nothing in an Android
 * WebView: there is no print dialog there, so the button appeared to be broken
 * in the app while working fine in a desktop browser.
 */
async function buildPdf(t: ReceiptData) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const M = 56; // page margin
  const W = doc.internal.pageSize.getWidth();
  const ref = t.id.slice(0, 12).toUpperCase();
  const created = new Date(t.createdAt).toLocaleString();
  let y = M;

  const label = (s: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110);
    doc.text(s, x, yy);
  };
  /** Right-aligned against the page's right margin. */
  const value = (s: string, yy: number) => {
    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(17);
    doc.text(s, W - M, yy, { align: 'right' });
  };

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold').setFontSize(26).setTextColor(17);
  doc.text('meow', M, y);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110);
  doc.text('International money transfer', M, y + 14);

  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(17);
  doc.text('Transfer Receipt', W - M, y, { align: 'right' });
  doc.setFont('courier', 'normal').setFontSize(9).setTextColor(85);
  doc.text(`Ref: ${ref}`, W - M, y + 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(created, W - M, y + 28, { align: 'right' });

  y += 46;
  doc.setDrawColor(17).setLineWidth(1.4).line(M, y, W - M, y);
  y += 34;

  // ── Amounts ─────────────────────────────────────────────────────────────
  label('You sent', M, y);
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(17);
  doc.text(`${parseFloat(t.amount).toFixed(2)} ${t.sendCurrency}`, M, y + 24);

  if (t.receiveAmount) {
    label('They received', W / 2, y);
    doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(20, 140, 90);
    doc.text(
      `${parseFloat(t.receiveAmount).toFixed(2)} ${t.receiveCurrency}`,
      W / 2,
      y + 24,
    );
  }
  y += 52;
  doc.setDrawColor(225).setLineWidth(0.8).line(M, y, W - M, y);
  y += 26;

  // ── Detail rows ─────────────────────────────────────────────────────────
  const rows: [string, string][] = [];
  if (t.senderName) rows.push(['Sender', t.senderName]);
  if (t.recipient) {
    rows.push(['Recipient', t.recipient.name]);
    rows.push(['Destination', t.recipient.country]);
    rows.push(['Bank account', t.recipient.bankAccount]);
  }
  if (t.fxRateApplied) {
    rows.push([
      'Exchange rate',
      `1 ${t.sendCurrency} = ${parseFloat(t.fxRateApplied).toFixed(4)} ${t.receiveCurrency}`,
    ]);
  }
  rows.push(['Status', t.status.replace(/_/g, ' ')]);
  rows.push(['Date', created]);

  for (const [k, v] of rows) {
    label(k, M, y);
    value(v, y);
    y += 22;
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  y += 12;
  doc.setDrawColor(225).setLineWidth(0.8).line(M, y, W - M, y);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(130);
  doc.text(
    `Generated ${new Date().toLocaleString()} · Reference ${ref}`,
    M,
    y + 18,
  );
  doc.text(
    'This receipt is a record of a transfer instruction and is not a bank statement.',
    M,
    y + 30,
  );

  return { doc, filename: `meow-receipt-${ref}.pdf` };
}

/**
 * Produce the receipt and hand it to the platform.
 *
 * Native: written to the cache directory and passed to the OS share sheet, so
 * the user can save it to Files, mail it, or send it on — which is what a
 * remittance receipt is actually for.
 * Web: a normal download.
 *
 * The Capacitor plugins are imported lazily so neither they nor jsPDF are
 * pulled into the initial bundle; this path runs only when a delivered
 * transfer's receipt is exported.
 */
export async function shareReceipt(t: ReceiptData): Promise<void> {
  const { doc, filename } = await buildPdf(t);

  if (!isNative()) {
    doc.save(filename);
    return;
  }

  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  // jsPDF hands back a full data URI; Filesystem wants the payload only.
  const base64 = doc.output('datauristring').split(',')[1];

  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });

  await Share.share({
    title: 'Transfer receipt',
    text: `Meow transfer receipt ${filename.replace(/\.pdf$/, '')}`,
    url: uri,
    dialogTitle: 'Share receipt',
  });
}
