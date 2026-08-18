import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../components/BackBar';
import {
  Body,
  Button,
  Card,
  Divider,
  Field,
  Loader,
  Note,
  Row,
  Screen,
  Title,
} from '../../components/ui';
import api, { errorMessage } from '../../lib/api';
import { clearCorridorCache } from '../../lib/corridors';
import { countryFlag, formatAmount } from '../../lib/money';
import type { Corridor } from '../../lib/types';
import { colors, radius } from '../../theme/tokens';

/** base × (10000 − marginBps) / 10000 — the same maths computeQuote applies. */
function appliedRate(baseRate: string, marginBps: number): number {
  return (Number(baseRate) * (10000 - marginBps)) / 10000;
}

export default function AdminCorridors() {
  const [list, setList] = useState<Corridor[] | null>(null);
  const [editing, setEditing] = useState<Corridor | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Corridor[]>('/admin/corridors');
      setList(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load corridors.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <BackBar title="Corridors" />
      <Screen>
        <View style={{ gap: 12 }}>
          <Title size={24}>Corridors</Title>
          <Body size={13}>
            The applied rate is the base rate less the margin. Customers only ever see the applied
            rate — changing either of these changes every quote immediately.
          </Body>

          {error ? <Note>{error}</Note> : null}

          {!list ? (
            <Loader />
          ) : (
            list.map((c) => (
              <Pressable key={c.id} onPress={() => setEditing(c)}>
                <Card>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Row gap={7}>
                        <Body size={14.5} tone="ink" weight="700">
                          {countryFlag(c.fromCountry)} {c.fromCurrency} → {c.toCurrency}{' '}
                          {countryFlag(c.toCountry)}
                        </Body>
                        <View
                          style={{
                            backgroundColor: c.active ? colors.accentSoft : colors.line,
                            borderRadius: radius.pill,
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                          }}
                        >
                          <Body size={10} tone={c.active ? 'accent' : 'faint'} weight="700">
                            {c.active ? 'Active' : 'Off'}
                          </Body>
                        </View>
                      </Row>
                      <Body size={11.5} tone="faint" style={{ marginTop: 3 }}>
                        base {formatAmount(c.baseRate, 4)} · margin {c.marginBps} bps · fee{' '}
                        {formatAmount(c.feeFlat, 2)} + {c.feePercentBps} bps
                      </Body>
                      <Body size={11.5} tone="faint">
                        limits {formatAmount(c.minSendAmount, 0)}–
                        {formatAmount(c.maxSendAmount, 0)} {c.fromCurrency}
                      </Body>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Body size={16} tone="ink" weight="700" numbers>
                        {formatAmount(appliedRate(c.baseRate, c.marginBps), 4)}
                      </Body>
                      <Body size={10} tone="faint">
                        applied
                      </Body>
                    </View>
                  </Row>
                </Card>
              </Pressable>
            ))
          )}
        </View>
      </Screen>

      {editing && (
        <EditCorridor
          corridor={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            clearCorridorCache();
            await load();
          }}
        />
      )}
    </SafeAreaView>
  );
}

function EditCorridor({
  corridor,
  onClose,
  onSaved,
}: {
  corridor: Corridor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [baseRate, setBaseRate] = useState(String(corridor.baseRate));
  const [marginBps, setMarginBps] = useState(String(corridor.marginBps));
  const [feeFlat, setFeeFlat] = useState(String(corridor.feeFlat));
  const [feePercentBps, setFeePercentBps] = useState(String(corridor.feePercentBps));
  const [minSendAmount, setMin] = useState(String(corridor.minSendAmount));
  const [maxSendAmount, setMax] = useState(String(corridor.maxSendAmount));
  const [active, setActive] = useState(corridor.active);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reasonReady = reason.trim().length >= 3;

  const preview = appliedRate(baseRate || '0', Number(marginBps) || 0);

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      // Sent as numbers: UpdateCorridorDto transforms strings, but sending the
      // right type keeps the validation error surface small.
      await api.patch(`/admin/corridors/${corridor.id}`, {
        reason: reason.trim(),
        baseRate: Number(baseRate),
        marginBps: Number(marginBps),
        feeFlat: Number(feeFlat),
        feePercentBps: Number(feePercentBps),
        minSendAmount: Number(minSendAmount),
        maxSendAmount: Number(maxSendAmount),
        active,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Could not save this corridor.'));
      setBusy(false);
    }
  };

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(18,23,20,0.45)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.canvas,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: '90%',
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 34 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Title size={20}>
                {corridor.fromCurrency} → {corridor.toCurrency}
              </Title>
              <Pressable onPress={onClose} hitSlop={10}>
                <Body size={14} tone="faint" weight="600">
                  Close
                </Body>
              </Pressable>
            </Row>

            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body size={13}>Applied rate customers will see</Body>
                <Body size={17} tone="ink" weight="700" numbers>
                  {formatAmount(preview, 4)}
                </Body>
              </Row>
            </Card>

            {error ? <Note>{error}</Note> : null}

            <Field label="Base rate" value={baseRate} onChangeText={setBaseRate} keyboardType="decimal-pad" />
            <Field
              label="Margin (bps)"
              value={marginBps}
              onChangeText={setMarginBps}
              keyboardType="number-pad"
              hint="100 bps = 1%. Taken off the base rate."
            />
            <Field label="Flat fee" value={feeFlat} onChangeText={setFeeFlat} keyboardType="decimal-pad" />
            <Field
              label="Percent fee (bps)"
              value={feePercentBps}
              onChangeText={setFeePercentBps}
              keyboardType="number-pad"
            />
            <Row gap={10}>
              <View style={{ flex: 1 }}>
                <Field label="Min send" value={minSendAmount} onChangeText={setMin} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Max send" value={maxSendAmount} onChangeText={setMax} keyboardType="decimal-pad" />
              </View>
            </Row>

            <Divider />

            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Body size={14} tone="ink" weight="600">
                  Active
                </Body>
                <Body size={12} tone="faint">
                  Turning this off stops all new transfers on this corridor.
                </Body>
              </View>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ true: colors.accent, false: colors.lineStrong }}
                thumbColor={colors.card}
              />
            </Row>

            <Divider />

            {/* Repricing a corridor changes what every future customer on it
                pays, so the justification is recorded alongside the before and
                after values. */}
            <Field
              label="Reason"
              hint="Required. Kept in the audit log with the previous values."
              placeholder="Why is this corridor being repriced?"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={200}
            />

            <Button
              label="Save corridor"
              variant="primary"
              loading={busy}
              disabled={!reasonReady}
              onPress={save}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
