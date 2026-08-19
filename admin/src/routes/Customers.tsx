import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Empty, PageHeader, Pill } from '../components/ui';
import api from '../lib/api';

interface CustomerRow {
  id: string;
  email: string;
  country: string | null;
  role: string;
  suspended: boolean;
  createdAt: string;
  transferCount: number;
}

interface Page {
  items: CustomerRow[];
  total: number;
}

export default function Customers() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: async () =>
      (
        await api.get<Page>('/admin/users', {
          params: search ? { search } : {},
        })
      ).data,
  });

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={data ? `${data.total} accounts` : undefined}
        action={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email"
            className="w-64 rounded-lg border border-line-strong bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        }
      />

      <Card>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : !data?.items.length ? (
          <Empty>No accounts match.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 text-right font-medium">Transfers</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">{c.email}</td>
                  <td className="px-4 py-3 text-ink-muted">{c.country ?? '—'}</td>
                  <td className="tabular px-4 py-3 text-right text-ink">
                    {c.transferCount}
                  </td>
                  <td className="px-4 py-3">
                    {c.suspended ? (
                      <Pill tone="danger">Suspended</Pill>
                    ) : (
                      <Pill tone="success">Active</Pill>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(c.createdAt).toLocaleDateString()}
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
