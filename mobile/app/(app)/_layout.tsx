import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ColorValue, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/AuthContext';
import { useLive } from '../../lib/sockets';
import { colors, radius, shadow } from '../../theme/tokens';

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
          backgroundColor: colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -26,
          borderWidth: 4,
          borderColor: colors.paper,
          opacity: pressed ? 0.85 : 1,
        },
        shadow.liftLg,
      ]}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path
          d="M12 19V5M6 11l6-6 6 6"
          stroke={colors.mint}
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
        backgroundColor: colors.clay,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 9.5, fontWeight: '700' }}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  );
}

export default function AppLayout() {
  const { status } = useAuth();
  const { unreadCount } = useLive();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (status !== 'signedIn') return <Redirect href="/(auth)/welcome" />;

  // The send flow and full-screen detail views cover the tab bar; hiding it
  // stops a half-finished transfer from being one tap away from abandonment.
  const hideTabs =
    pathname.startsWith('/send') ||
    /^\/activity\/[^/]+$/.test(pathname) ||
    pathname.startsWith('/wallet/fund') ||
    pathname.startsWith('/recipients/');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.ink3,
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

      {/* Reachable by push, but never their own tab. */}
      <Tabs.Screen name="wallet" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="referrals" options={{ href: null }} />
    </Tabs>
  );
}
