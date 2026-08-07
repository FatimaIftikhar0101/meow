import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CatMark } from '../../components/CatMark';
import { Body, Button, Title } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { googleEnabled, useAuth } from '../../lib/AuthContext';
import { colors } from '../../theme/tokens';

/**
 * The constellation from the design artifact: thirteen rays out of the mark,
 * seven of them terminating in a star. It reads as a network without drawing a
 * map, which matters because at this point we do not know where the user sends.
 */
const RAYS: [number, number][] = [
  [150, 20], [206, 34], [94, 34], [246, 66], [54, 66], [276, 112], [24, 112],
  [272, 170], [28, 170], [240, 224], [60, 224], [192, 268], [108, 268],
];
const STARS: [number, number][] = [
  [150, 20], [246, 66], [54, 66], [276, 112], [24, 112], [240, 224], [60, 224],
];

function Constellation() {
  return (
    <Svg viewBox="0 0 300 340" width="100%" height="100%" style={{ position: 'absolute' }}>
      <Defs>
        <RadialGradient id="wg" cx="50%" cy="42%" r="62%">
          <Stop offset="0%" stopColor={colors.mint} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={colors.mint} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={300} height={340} fill="url(#wg)" />
      <G stroke={colors.mint} strokeWidth={0.7} opacity={0.38} strokeLinecap="round">
        {RAYS.map(([x, y], i) => (
          <Path key={i} d={`M150 142 L${x} ${y}`} />
        ))}
      </G>
      <G fill={colors.mint} opacity={0.8}>
        {STARS.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={2} />
        ))}
      </G>
      <Circle cx={150} cy={142} r={42} fill="#182018" stroke="#2B372B" strokeWidth={1} />
    </Svg>
  );
}

export default function Welcome() {
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
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* The mark is centred by absolute position over the same box the
            constellation fills, so the two share one coordinate space and the
            cat cannot drift off the circle as the phone size changes. */}
        <View style={{ flex: 1, position: 'relative' }}>
          <Constellation />
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '41.7%',
              alignItems: 'center',
            }}
          >
            <CatMark size={52} ring />
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: 20, gap: 18 }}>
          <View>
            <Title size={30} tone="onInk" style={{ lineHeight: 35 }}>
              Send money home{'\n'}for <Title size={30} tone="mint">$2.99</Title> flat.
            </Title>
            <Body size={13.5} tone="onInk2" style={{ marginTop: 10, maxWidth: 300 }}>
              The rate you see is the rate you get. Track every transfer from your phone until it
              reaches their account.
            </Body>
          </View>

          <View style={{ gap: 9 }}>
            <Button
              label="Create an account"
              variant="mint"
              onPress={() => router.push('/(auth)/register')}
            />
            {googleEnabled && (
              <Button
                label="Continue with Google"
                variant="outline"
                loading={busy}
                onPress={onGoogle}
                style={{ borderColor: '#2E362E' }}
                icon={<GoogleG />}
              />
            )}
            <Button
              label="Log in"
              variant="ghost"
              onPress={() => router.push('/(auth)/login')}
              style={{ borderColor: '#2E362E', borderWidth: 1 }}
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
