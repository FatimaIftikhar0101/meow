import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControlProps,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, shadow, space } from '../theme/tokens';

/* ── Text ──────────────────────────────────────────────────────────────── */

type TextTone = 'ink' | 'ink2' | 'ink3' | 'mint' | 'amber' | 'clay' | 'onInk' | 'onInk2';
const TONE: Record<TextTone, string> = {
  ink: colors.ink,
  ink2: colors.ink2,
  ink3: colors.ink3,
  mint: colors.mintInk,
  amber: colors.amber,
  clay: colors.clay,
  onInk: colors.onInk,
  onInk2: colors.onInk2,
};

export function Title({
  children,
  tone = 'ink',
  size = 30,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  tone?: TextTone;
  size?: number;
  style?: object;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontSize: size, fontWeight: '700', letterSpacing: -size * 0.028, color: TONE[tone] },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  tone = 'ink2',
  size = 14,
  weight = '400',
  numbers = false,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  tone?: TextTone;
  size?: number;
  weight?: '400' | '500' | '600' | '700';
  /** Tabular figures, so in-place updates do not make the row jitter. */
  numbers?: boolean;
  style?: object;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontSize: size, fontWeight: weight, color: TONE[tone], lineHeight: size * 1.45 },
        numbers && { fontVariant: ['tabular-nums'] as const },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Kicker({ children, tone = 'mint' }: { children: React.ReactNode; tone?: TextTone }) {
  return (
    <Text
      style={{
        fontSize: 10.5,
        fontWeight: '700',
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        color: TONE[tone],
      }}
    >
      {children}
    </Text>
  );
}

/* ── Surfaces ──────────────────────────────────────────────────────────── */

export function Card({
  children,
  style,
  dark = false,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  dark?: boolean;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: dark ? colors.ink : colors.card,
          borderRadius: radius.lg,
          borderWidth: dark ? 0 : 1,
          borderColor: colors.line,
          padding: padded ? 16 : 0,
        },
        dark ? shadow.liftLg : shadow.lift,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: 1, backgroundColor: colors.line, marginLeft: inset }} />;
}

/* ── Buttons ───────────────────────────────────────────────────────────── */

type Variant = 'primary' | 'mint' | 'ghost' | 'outline' | 'danger';

const VARIANT: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.ink, fg: colors.onInk, border: colors.ink },
  mint: { bg: colors.mint, fg: colors.ink, border: colors.mint },
  ghost: { bg: 'transparent', fg: colors.ink, border: 'transparent' },
  outline: { bg: 'transparent', fg: colors.ink, border: colors.line2 },
  danger: { bg: colors.clayLo, fg: colors.clay, border: colors.clayLo },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  compact?: boolean;
}) {
  const v = VARIANT[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingVertical: compact ? 10 : 15,
          paddingHorizontal: compact ? 14 : 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: off ? 0.45 : pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <>
          {icon}
          <Text style={{ color: v.fg, fontWeight: '600', fontSize: compact ? 13 : 15 }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/* ── Form field ────────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  style,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.ink }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.ink3}
        {...input}
        style={[
          {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: error ? colors.clay : colors.line2,
            borderRadius: radius.sm,
            paddingHorizontal: 14,
            paddingVertical: 13,
            fontSize: 15,
            color: colors.ink,
          },
          style,
        ]}
      />
      {error ? (
        <Body size={12} tone="clay">
          {error}
        </Body>
      ) : hint ? (
        <Body size={12} tone="ink3">
          {hint}
        </Body>
      ) : null}
    </View>
  );
}

/* ── Feedback ──────────────────────────────────────────────────────────── */

export function Note({
  children,
  tone = 'clay',
}: {
  children: React.ReactNode;
  tone?: 'clay' | 'amber' | 'mint';
}) {
  const map = {
    clay: { bg: colors.clayLo, fg: colors.clay },
    amber: { bg: colors.amberLo, fg: colors.amber },
    mint: { bg: colors.mintLo, fg: colors.mintInk },
  }[tone];
  return (
    <View
      style={{
        backgroundColor: map.bg,
        borderRadius: radius.sm,
        paddingHorizontal: 14,
        paddingVertical: 11,
      }}
    >
      <Text style={{ color: map.fg, fontSize: 13, lineHeight: 19, fontWeight: '500' }}>
        {children}
      </Text>
    </View>
  );
}

export function Loader({ label }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={colors.mintInk} />
      {label ? (
        <Body size={13} tone="ink3">
          {label}
        </Body>
      ) : null}
    </View>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24, gap: 8 }}>
      <Title size={17}>{title}</Title>
      {body ? (
        <Body size={13.5} tone="ink3" style={{ textAlign: 'center' }}>
          {body}
        </Body>
      ) : null}
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

/* ── Layout ────────────────────────────────────────────────────────────── */

export function Screen({
  children,
  scroll = true,
  refreshControl,
  background = colors.paper,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  background?: string;
  contentStyle?: ViewStyle;
}) {
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: background }, contentStyle]}>{children}</View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: background }}
      contentContainerStyle={[{ padding: space.lg, paddingBottom: 40 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

export function Row({
  children,
  gap = 10,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
  );
}

export const s = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
