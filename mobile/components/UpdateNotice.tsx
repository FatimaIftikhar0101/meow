import Constants from 'expo-constants';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { runningVersion, type UpdateState } from '../lib/updates';
import { radius, useTheme } from '../theme/tokens';
import { Body, Button, Row } from './ui';

/**
 * "An update is ready" — an offer, never an interruption.
 *
 * Deliberately not a modal and not a blocking gate. The update is already
 * downloaded and will apply by itself the next time the app is opened cold, so
 * there is nothing urgent to decide: the only thing this buys is getting the
 * fix a few hours sooner. A dialog demanding attention for that, on a screen
 * somebody opened to check whether their money arrived, would be a worse app
 * than one that never updated at all.
 *
 * Dismissing hides it for this session. It comes back on the next launch, by
 * which point the update has usually applied on its own anyway.
 */
export function UpdateBanner({ update }: { update: UpdateState }) {
  const { colors } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  if (!update.ready || dismissed) return null;

  return (
    <View
      style={{
        backgroundColor: colors.accentSoft,
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Row style={{ justifyContent: 'space-between' }} gap={12}>
        <View style={{ flex: 1 }}>
          <Body size={13} tone="ink" weight="600">
            An update is ready
          </Body>
          <Body size={12} tone="muted" style={{ marginTop: 1 }}>
            It will apply next time you open Meow, or restart now.
          </Body>
        </View>
        <Row gap={4}>
          <Pressable
            onPress={() => setDismissed(true)}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingHorizontal: 6 })}
          >
            <Body size={12} tone="faint" weight="600">
              Later
            </Body>
          </Pressable>
          <Button label="Restart" compact onPress={() => void update.restart()} />
        </Row>
      </Row>
    </View>
  );
}

/**
 * The version row in Profile.
 *
 * "Which version are you on?" is the first question on any support call, and
 * over-the-air updates have made the store version number stop answering it —
 * two phones both showing 1.0.0 can be running different JavaScript. So the
 * update id is shown too, and it is the thing support should ask for.
 *
 * The manual check exists for the case where someone has been told a fix is
 * out. It reports "You're up to date" on purpose: a button that does nothing
 * visible when there is nothing to do reads as broken.
 */
export function VersionRow({ update }: { update: UpdateState }) {
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={{ paddingVertical: 14, gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }} gap={12}>
        <View style={{ flex: 1 }}>
          <Body size={14} tone="ink" weight="600">
            Version
          </Body>
          <Body size={12} tone="faint" style={{ marginTop: 2 }}>
            {runningVersion(appVersion)}
          </Body>
        </View>
        {update.ready ? (
          <Button label="Restart" compact onPress={() => void update.restart()} />
        ) : (
          <Button
            label="Check"
            variant="secondary"
            compact
            loading={update.checking}
            onPress={() => void update.check()}
          />
        )}
      </Row>

      {update.error ? (
        <Body size={12} tone="danger">
          {update.error}
        </Body>
      ) : update.ready ? (
        <Body size={12} tone="accent">
          An update is downloaded. Restart to use it, or it will apply next time you open Meow.
        </Body>
      ) : update.upToDate ? (
        <Body size={12} tone="faint">
          You&apos;re up to date.
        </Body>
      ) : null}
    </View>
  );
}
