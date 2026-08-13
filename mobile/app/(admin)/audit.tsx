import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../components/BackBar';
import { Body, Card, Empty, Field, Loader, Note, Row, Screen, Title } from '../../components/ui';
import api, { errorMessage } from '../../lib/api';
import { dateTimeOf } from '../../lib/format';
import type { AuditRow, Paginated } from '../../lib/types';
import { colors, radius } from '../../theme/tokens';

/** Colour by what the action did, not by which module it came from. */
function toneFor(action: string): 'accent' | 'danger' | 'pending' | 'faint' {
  if (/delivered|passed|rewarded|unsuspend/.test(action)) return 'accent';
  if (/fail|suspend|cancel|force/.test(action)) return 'danger';
  if (/admin\./.test(action)) return 'pending';
  return 'faint';
}

export default function AdminAudit() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AuditRow> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await api.get<Paginated<AuditRow>>('/admin/audit', {
          params: { page, pageSize: 50, ...(action.trim() ? { action: action.trim() } : {}) },
        });
        setData(res.data);
        setError('');
      } catch (err) {
        setError(errorMessage(err, 'Could not load the audit log.'));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [action, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <BackBar title="Audit log" />
      <Screen>
        <View style={{ gap: 12 }}>
          <Title size={24}>Audit log</Title>
          <Field
            label="Filter by exact action"
            value={action}
            onChangeText={(t) => {
              setAction(t);
              setPage(1);
            }}
            autoCapitalize="none"
            placeholder="transfer.create"
            hint="Exact match, e.g. auth.login, wallet.fund, admin.user.suspend"
          />

          {error ? <Note>{error}</Note> : null}

          {!data ? (
            <Loader />
          ) : data.items.length === 0 ? (
            <Empty title="No entries" body="Nothing matches that action." />
          ) : (
            <View style={{ gap: 7 }}>
              {data.items.map((r) => (
                <Card key={r.id} padded={false} style={{ padding: 12 }}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Body size={12.5} tone={toneFor(r.action)} weight="700">
                        {r.action}
                      </Body>
                      <Body size={11} tone="faint" numberOfLines={1}>
                        {r.entityType ?? '—'}
                        {r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}
                        {r.userId ? ` · by ${r.userId.slice(0, 8)}` : ''}
                      </Body>
                      {r.metadata && Object.keys(r.metadata).length > 0 && (
                        <View
                          style={{
                            backgroundColor: colors.canvas,
                            borderRadius: radius.xs,
                            padding: 7,
                            marginTop: 3,
                          }}
                        >
                          <Body size={10.5} tone="faint">
                            {JSON.stringify(r.metadata)}
                          </Body>
                        </View>
                      )}
                    </View>
                    <Body size={10.5} tone="faint" style={{ marginLeft: 8 }}>
                      {dateTimeOf(r.createdAt)}
                    </Body>
                  </Row>
                </Card>
              ))}

              {pages > 1 && (
                <Row style={{ justifyContent: 'space-between', paddingTop: 4 }}>
                  <Pressable disabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
                    <Body size={13} tone={page <= 1 ? 'faint' : 'accent'} weight="600">
                      ‹ Previous
                    </Body>
                  </Pressable>
                  <Body size={12} tone="faint">
                    Page {page} of {pages} · {data.total} entries
                  </Body>
                  <Pressable disabled={page >= pages} onPress={() => setPage((p) => p + 1)}>
                    <Body size={13} tone={page >= pages ? 'faint' : 'accent'} weight="600">
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
