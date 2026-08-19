import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Empty, PageHeader, Pill } from '../components/ui';
import api from '../lib/api';

type TransferStatus =
  | 'initiated'
  | 'payment_received'
  | 'compliance_check'
  | 'fx_converted'
  | 'payout_processing'
  | 'delivered'
  | 'failed'
  | 'cancelled';

interface TransferRow {
  id: string;
  userEmail: string;
  recipient: { name: string; country: string };
  sendAmount: string;
  sendCurrency: string;
  receiveAmount: string | null;
  receiveCurrency: string | null;
  status: TransferStatus;
  createdAt: string;
}

interface Page {
  items: TransferRow[];
  total: number;
  page: number;
  pageSize: number;
}

const TERMINAL: TransferStatus[] = ['delivered', 'failed', 'cancelled'];

const STATUS_LABEL: Record<TransferStatus, string> = {
  initiated: 'Initiated',
  payment_received: 'Payment received',
  compliance_check: 'Compliance check',
  fx_converted: 'FX converted',
  payout_processing: 'Paying out',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function toneFor(status: TransferStatus) {
  if (status === 'delivered') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  if (TERMINAL.includes(status)) return 'neutral' as const;
  return 'pending' as const;
}

/**
 * Money in flight.
 *
 * Amounts arrive as decimal strings and are rendered as decimal strings —
 * never parsed into a float on the way past. This column is the one a person
 * checks against a bank statement.
 */
export default function Transfers() {
  const [status, setStatus] = useState<TransferStatus | ''>('');

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', status],
    queryFn: async () =>
      (
        await api.get<Page>('/admin/transfers', {
          params: status ? { status } : {},
        })
      ).data,
    // In-flight transfers move on a timer server-side, so a stale board is
    // worse than a slightly chatty one.
    refetchInterval: 15_000,
  });

  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle={
          data ? `${data.total} total` : 'Every transfer, newest first.'
        }
        action={
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TransferStatus | '')}
            className="rounded-lg border border-line-strong bg-card px-3 py-2 text-sm text-ink"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as TransferStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        }
      />

      <Card>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : !data?.items.length ? (
          <Empty>Nothing here.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">Sender</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 text-right font-medium">Sent</th>
                <th className="px-4 py-3 text-right font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">{t.userEmail}</td>
                  <td className="px-4 py-3 text-ink">
                    {t.recipient.name}
                    <span className="ml-1.5 text-xs text-ink-faint">
                      {t.recipient.country}
                    </span>
                  </td>
                  <td className="tabular px-4 py-3 text-right text-ink">
                    {t.sendAmount} {t.sendCurrency}
                  </td>
                  <td className="tabular px-4 py-3 text-right text-ink-muted">
                    {t.receiveAmount
                      ? `${t.receiveAmount} ${t.receiveCurrency ?? ''}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={toneFor(t.status)}>{STATUS_LABEL[t.status]}</Pill>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(t.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
