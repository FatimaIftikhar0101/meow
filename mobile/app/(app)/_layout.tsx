import { Redirect, usePathname, useRouter } from 'expo-router';
// SDK 57 deprecates the `Tabs` re-export from 'expo-router' itself. Both paths
// resolve to the same module today — expo-router/js-tabs is
// `require('./build/layouts/Tabs')`, which is what the deprecated name
// re-exports — so this is a rename now and not a migration later.
import { Tabs } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ColorValue, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GreetingIntro } from '../../components/GreetingIntro';
import { useAuth } from '../../lib/AuthContext';
import { useLive } from '../../lib/sockets';
import { radius, shadow, useTheme } from '../../theme/tokens';

/* ── Icons. Drawn here rather than pulled from an icon font: five glyphs is
      not worth a dependency, and these match the design's 1.6px stroke. ── */

function Icon({
  name,
  color,
  size = 22,
}: {
  name: 'home' | 'activity' | 'people' | 'profile';
  // react-navigation hands the tab tint through as ColorValue; react-native-svg
  // takes the same type, so it passes straight through untouched.
  color: ColorValue;
  size?: number;
}) {
  const p = { stroke: color, strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" {...p} />}
      {name === 'activity' && (
        <>
          <Path d="M3 12h4l2.5-6 4 13 2.5-7h5" {...p} />
        </>
      )}
      {name === 'people' && (
        <>
          <Circle cx={9} cy={8} r={3.4} {...p} />
          <Path d="M3 20c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2" {...p} />
          <Path d="M16 5.6a3.4 3.4 0 0 1 0 6.5M17.5 14.9c2.1.6 3.5 2.4 3.5 5.1" {...p} />
        </>
      )}
      {name === 'profile' && (
        <>
          <Circle cx={12} cy={8} r={3.6} {...p} />
          <Path d="M4.5 20c0-3.6 3.3-6 7.5-6s7.5 2.4 7.5 6" {...p} />
        </>
      )}
    </Svg>
  );
}

/**
 * The raised centre button, lifted from the reference decks. It is not a tab —
 * sending is a flow with its own back stack, and making it a tab would let you
 * swipe out of a half-entered transfer.
 */
function SendButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Send money"
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(app)/send');
      }}
      style={({ pressed }) => [
        {
          width: 56,
          height: 56,
          borderRadius: 28,
          // Accent, not ink: the arrow inside is accent-coloured, and charcoal
          // on slate-700 is a 1.1:1 pairing — the glyph disappeared entirely.
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -26,
          borderWidth: 4,
          borderColor: colors.canvas,
          opacity: pressed ? 0.85 : 1,
        },
        shadow.liftLg,
      ]}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path
          d="M12 19V5M6 11l6-6 6 6"
          stroke={colors.onAccent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}

function Badge({ count }: { count: number }) {
  const { colors } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -4,
        right: -9,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        paddingHorizontal: 4,
        backgroundColor: colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.onDanger, fontSize: 9.5, fontWeight: '700' }}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  );
}

export default function AppLayout() {
  const { colors } = useTheme();
  const { status, profile } = useAuth();
  const { unreadCount } = useLive();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (status !== 'signedIn') return <Redirect href="/(auth)/welcome" />;

  const firstName = profile?.firstName || profile?.fullName?.split(' ')[0] || 'there';

  // The send flow and full-screen detail views cover the tab bar; hiding it
  // stops a half-finished transfer from being one tap away from abandonment.
  const hideTabs =
    pathname.startsWith('/send') ||
    /^\/activity\/[^/]+$/.test(pathname) ||
    pathname.startsWith('/wallet/fund') ||
    pathname.startsWith('/recipients/') ||
    // A six-digit code is a single task with a back arrow; leaving the tabs up
    // invites wandering off halfway through one that expires in 15 minutes.
    pathname.startsWith('/verify-email');

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      /*
       * `backBehavior` is left at its default of `firstRoute`, deliberately.
       *
       * `history` looks like the fix for "back from Wallet lands on Home" and
       * is a trap. Read TabRouter: under `history` every tab visit appends to
       * `state.history`, and GO_BACK only stops — letting Android close the
       * app — when that list has one entry. So after Home → Send → complete →
       * "Back to home", history is [send, home], and back on the dashboard
       * jumps *into* the send tab, which still holds the finished transfer.
       * Under `firstRoute` history on Home is length 1 and back exits, which
       * is what someone expects from a home screen.
       *
       * Back out of the pushed screens is fixed where the ambiguity actually
       * lives instead — each one names its own destination. See BackBar.
       */
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.accentMuted,
        tabBarStyle: hideTabs
          ? { display: 'none' }
          : {
              backgroundColor: colors.card,
              borderTopColor: colors.line,
              borderTopWidth: 1,
              height: 58 + insets.bottom,
              paddingTop: 6,
              paddingBottom: insets.bottom + 6,
            },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Icon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => <Icon name="activity" color={color} />,
        }}
      />
      <Tabs.Screen
        name="send"
        options={{
          title: '',
          tabBarButton: () => <SendButton />,
        }}
      />
      <Tabs.Screen
        name="recipients"
        options={{
          title: 'People',
          tabBarIcon: ({ color }) => <Icon name="people" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => (
            <View>
              <Icon name="profile" color={color} />
              <Badge count={unreadCount} />
            </View>
          ),
        }}
      />

      {/* Reachable by push, but never their own tab. A screen file sitting
          directly under (app) becomes a tab unless it says otherwise — which
          is how you end up shipping a tab labelled "verify-email". */}
      <Tabs.Screen name="wallet" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="referrals" options={{ href: null }} />
      <Tabs.Screen name="verify-email" options={{ href: null }} />
    </Tabs>

      {/* Over the tab bar as well as the content, so the greeting reads as one
          moment rather than as a panel that arrived inside the app. It removes
          itself; see GreetingIntro for why it only fires once per launch. */}
      <GreetingIntro name={firstName} />
    </View>
  );
}
