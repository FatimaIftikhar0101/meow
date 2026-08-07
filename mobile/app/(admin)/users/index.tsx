import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Body, Card, Empty, Field, Loader, Note, Row, Screen, Title } from '../../../components/ui';
import api, { errorMessage } from '../../../lib/api';
import { dateOf } from '../../../lib/format';
import type { AdminUserRow, Paginated } from '../../../lib/types';
import { colors, radius } from '../../../theme/tokens';

export default function AdminUsers() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminUserRow> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await api.get<Paginated<AdminUserRow>>('/admin/users', {
          params: { page, pageSize: 20, ...(search.trim() ? { search: search.trim() } : {}) },
        });
        setData(res.data);
        setError('');
      } catch (err) {
        setError(errorMessage(err, 'Could not load users.'));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <BackBar title="Users" />
      <Screen>
        <View style={{ gap: 13 }}>
          <Title size={24}>Users</Title>
          <Field
            label="Search by email"
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              setPage(1);
            }}
            autoCapitalize="none"
            placeholder="ayesha@"
          />

          {error ? <Note>{error}</Note> : null}

          {!data ? (
            <Loader />
          ) : data.items.length === 0 ? (
            <Empty title="No users match" body="Try a different search." />
          ) : (
            <View style={{ gap: 8 }}>
              {data.items.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() =>
                    router.push({ pathname: '/(admin)/users/[id]', params: { id: u.id } })
                  }
                >
                  <Card padded={false} style={{ padding: 13 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Row gap={7}>
                          <Body size={13.5} tone="ink" weight="600" numberOfLines={1}>
                            {u.email}
                          </Body>
                          {u.role === 'admin' && <Tag label="Admin" tone="mint" />}
                          {u.suspended && <Tag label="Suspended" tone="clay" />}
                        </Row>
                        <Body size={11.5} tone="ink3">
                          {u.country ?? '—'} · {u.transferCount} transfer
                          {u.transferCount === 1 ? '' : 's'} · joined {dateOf(u.createdAt)}
                        </Body>
                      </View>
                      <Body size={15} tone="ink3">
                        ›
                      </Body>
                    </Row>
                  </Card>
                </Pressable>
              ))}

              {pages > 1 && (
                <Row style={{ justifyContent: 'space-between', paddingTop: 4 }}>
                  <Pressable disabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
                    <Body size={13} tone={page <= 1 ? 'ink3' : 'mint'} weight="600">
                      ‹ Previous
                    </Body>
                  </Pressable>
                  <Body size={12} tone="ink3">
                    Page {page} of {pages} · {data.total} total
                  </Body>
                  <Pressable disabled={page >= pages} onPress={() => setPage((p) => p + 1)}>
                    <Body size={13} tone={page >= pages ? 'ink3' : 'mint'} weight="600">
                      Next ›
                    </Body>
                  </Pressable>
                </Row>
              )}
            </View>
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}

export function Tag({ label, tone }: { label: string; tone: 'mint' | 'clay' | 'amber' }) {
  const map = {
    mint: { bg: colors.mintLo, fg: colors.mintInk },
    clay: { bg: colors.clayLo, fg: colors.clay },
    amber: { bg: colors.amberLo, fg: colors.amber },
  }[tone];
  return (
    <View
      style={{
        backgroundColor: map.bg,
        borderRadius: radius.pill,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <Body size={10} weight="700" style={{ color: map.fg }}>
        {label}
      </Body>
    </View>
  );
}
