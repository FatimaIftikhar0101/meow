import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { BrandLockup, CatMark } from '../../components/CatMark';
import { Body, Button, Title } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { googleEnabled, useAuth } from '../../lib/AuthContext';
import { fonts, useTheme } from '../../theme/tokens';

/**
 * The corridor arc, which is the product's whole idea: money leaving one
 * country and landing in another. It replaced a constellation that read as
 * decoration and, before that, a landscape that read as beige.
 *
 * ── Why the box has a fixed aspectRatio ──────────────────────────────────
 * The mark is a React Native view laid over an SVG, so the two only line up if
 * they share a coordinate space. An SVG with `preserveAspectRatio` (the
 * default) letterboxes its viewBox inside whatever box it is given, which means
 * a percentage of the *container* is not a percentage of the *viewBox*.
 *
 * That was the bug on the phone: the mark was positioned at 41.7% of the
 * container to match a circle at y=142 of a 340-tall viewBox, and drifted off
 * that circle on any screen whose aspect ratio differed. Pinning the container
 * to the viewBox's own ratio removes the letterboxing, so the two agree by
 * construction rather than by luck.
 */
const VB_W = 274;
const VB_H = 150;
/** Apex of the arc, in viewBox units — also where the mark sits. */
const APEX_X = 137;
const APEX_Y = 66;
const MARK = 62;

function CorridorArc() {
  const { colors } = useTheme();
  return (
    <View style={{ width: '100%', aspectRatio: VB_W / VB_H }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {/* The whole journey, not yet travelled. */}
        <Path
          d="M26 122 Q137 14 248 122"
          stroke={colors.line}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
        />
        {/* The half already flown, in the client's Slate Blue Grey. */}
        <Path
          d={`M26 122 Q81.5 68 ${APEX_X} ${APEX_Y}`}
          stroke={colors.accentMuted}
          strokeWidth={2.6}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={26} cy={122} r={5.4} fill={colors.slab} />
        <Circle cx={248} cy={122} r={5.4} fill="none" stroke={colors.lineStrong} strokeWidth={2.2} />
        <SvgText x={26} y={142} fontSize={9} fill={colors.inkMuted} textAnchor="middle">
          CAD
        </SvgText>
        <SvgText x={248} y={142} fontSize={9} fill={colors.inkMuted} textAnchor="middle">
          PKR
        </SvgText>
      </Svg>

      {/* Centred on the apex: x is exactly half the viewBox, y a share of it. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${(APEX_Y / VB_H) * 100}%`,
          marginTop: -MARK / 2,
          alignItems: 'center',
        }}
        pointerEvents="none"
      >
        <CatMark size={MARK} />
      </View>
    </View>
  );
}

export default function Welcome() {
  const { name: scheme, colors } = useTheme();
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      Alert.alert('Google sign-in failed', errorMessage(err, 'Could not sign in with Google.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 }}>
          <BrandLockup size={30} />

          <View style={{ marginTop: 28 }}>
            <CorridorArc />
          </View>

          <View style={{ marginTop: 28 }}>
            <Title
              size={30}
              style={{ fontFamily: fonts.display, fontWeight: '400', lineHeight: 38 }}
            >
              Send money home.
            </Title>
            <Body size={14} tone="muted" style={{ marginTop: 10, maxWidth: 300 }}>
              A flat $2.99 fee, and you see the rate before anything leaves your wallet.
            </Body>
          </View>

          <View style={{ flex: 1 }} />

          <View style={{ gap: 9 }}>
            <Button
              label="Create an account"
              variant="primary"
              onPress={() => router.push('/(auth)/register')}
            />
            {googleEnabled && (
              <Button
                label="Continue with Google"
                variant="outline"
                loading={busy}
                onPress={onGoogle}
                icon={<GoogleG />}
              />
            )}
            {/* `ghost` renders accent-on-white. It used to render near-black on
                the near-black welcome screen, which is why this control shipped
                as an empty outline with no visible label. */}
            <Button
              label="I already have an account"
              variant="ghost"
              onPress={() => router.push('/(auth)/login')}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Google's four-colour G. Reproduced at brand colours, as their guidelines require. */
function GoogleG() {
  return (
    <Svg width={17} height={17} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.6 20.5h-1.9V20H24v8h11.3A12 12 0 1 1 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
      <Path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.6 5A20 20 0 0 0 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.6 20.5H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2A19.6 19.6 0 0 0 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </Svg>
  );
}
