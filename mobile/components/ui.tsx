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

/**
 * Tones name the job, not the colour. `accent` is whatever the brand's action
 * colour currently is; screens never learn that it happens to be slate.
 *
 * The `onSlab` pair is for text sitting on a dark surface. Keeping them as
 * distinct tones — rather than letting callers pass a hex — is what stops the
 * class of bug where dark text lands on a dark ground and vanishes.
 */
type TextTone =
  | 'ink'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'success'
  | 'pending'
  | 'danger'
  | 'onSlab'
  | 'onSlabMuted';

const TONE: Record<TextTone, string> = {
  ink: colors.ink,
  muted: colors.inkMuted,
  faint: colors.inkFaint,
  accent: colors.accent,
  success: colors.success,
  pending: colors.pending,
  danger: colors.danger,
  onSlab: colors.onSlab,
  onSlabMuted: colors.onSlabMuted,
};

export function Title({
  children,
  tone = 'ink',
  size = 28,
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
        { fontSize: size, fontWeight: '700', letterSpacing: -size * 0.026, color: TONE[tone] },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  tone = 'muted',
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

export function Kicker({
  children,
  tone = 'faint',
}: {
  children: React.ReactNode;
  tone?: TextTone;
}) {
  return (
    <Text
      style={{
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.7,
        textTransform: 'uppercase',
        color: TONE[tone],
      }}
    >
      {children}
    </Text>
  );
}

/** A section heading with an optional action on the right. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.between}>
      <Title size={15}>{title}</Title>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Body size={12} tone="accent" weight="600">
            {actionLabel}
          </Body>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Surfaces ──────────────────────────────────────────────────────────── */

/**
 * Cards are the same white as the canvas and separate by a hairline.
 *
 * They used to be a near-white on a tinted ground, which is precisely what made
 * the last round look grubby: two surfaces 1.10:1 apart in the same hue do not
 * read as two surfaces, they read as one dirty one. A card is white, or it is
 * `inset`, or it is a `slab` — never a shade of almost-white.
 */
export function Card({
  children,
  style,
  variant = 'card',
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: 'card' | 'inset' | 'slab';
  padded?: boolean;
}) {
  const v = {
    card: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1 },
    inset: { backgroundColor: colors.inset, borderColor: 'transparent', borderWidth: 0 },
    slab: { backgroundColor: colors.slab, borderColor: 'transparent', borderWidth: 0 },
  }[variant];

  return (
    <View
      style={[
        { ...v, borderRadius: radius.lg, padding: padded ? 16 : 0 },
        variant === 'slab' ? shadow.liftLg : variant === 'card' ? shadow.lift : shadow.none,
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

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

/**
 * Every variant states both its ground and its foreground, and `onSlab` swaps
 * the transparent variants to light text.
 *
 * This exists because of a real bug: `ghost` previously hard-coded near-black
 * text, so on the dark welcome screen the "Log in" button rendered as an empty
 * outline — the control was there, the label was invisible. A variant that
 * knows only its foreground cannot be safe on an unknown ground, so the ground
 * is part of the choice now rather than something the caller has to remember.
 */
function variantStyle(
  variant: Variant,
  onSlab: boolean,
): { bg: string; fg: string; border: string } {
  if (onSlab) {
    switch (variant) {
      case 'primary':
        return { bg: colors.onSlab, fg: colors.accentDeep, border: colors.onSlab };
      case 'secondary':
        return { bg: 'rgba(255,255,255,0.14)', fg: colors.onSlab, border: 'transparent' };
      case 'outline':
        return { bg: 'transparent', fg: colors.onSlab, border: 'rgba(255,255,255,0.34)' };
      case 'ghost':
        return { bg: 'transparent', fg: colors.onSlab, border: 'transparent' };
      case 'danger':
        return { bg: 'transparent', fg: colors.danger, border: colors.danger };
    }
  }
  switch (variant) {
    case 'primary':
      return { bg: colors.accent, fg: colors.onAccent, border: colors.accent };
    case 'secondary':
      return { bg: colors.inset, fg: colors.ink, border: colors.inset };
    case 'outline':
      return { bg: colors.card, fg: colors.ink, border: colors.lineStrong };
    case 'ghost':
      return { bg: 'transparent', fg: colors.accent, border: 'transparent' };
    case 'danger':
      return { bg: colors.card, fg: colors.danger, border: colors.dangerSoft };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  compact = false,
  onSlab = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  compact?: boolean;
  /** Set when the button sits on a dark surface, so the label stays legible. */
  onSlab?: boolean;
}) {
  const v = variantStyle(variant, onSlab);
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
          paddingVertical: compact ? 10 : 14,
          paddingHorizontal: compact ? 14 : 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: off ? 0.45 : pressed ? 0.85 : 1,
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
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.ink }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.inkFaint}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: error ? colors.danger : focused ? colors.accent : colors.lineStrong,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 13,
            fontSize: 15,
            color: colors.ink,
          },
          style,
        ]}
      />
      {error ? (
        <Body size={12} tone="danger">
          {error}
        </Body>
      ) : hint ? (
        <Body size={12} tone="faint">
          {hint}
        </Body>
      ) : null}
    </View>
  );
}

/* ── Feedback ──────────────────────────────────────────────────────────── */

/**
 * A banner. Tones are outcomes — `danger`, `pending`, `success`, `info` — so a
 * palette change never turns a warning into a confirmation.
 */
export function Note({
  children,
  tone = 'danger',
}: {
  children: React.ReactNode;
  tone?: 'danger' | 'pending' | 'success' | 'info';
}) {
  const map = {
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    pending: { bg: colors.pendingSoft, fg: colors.pending },
    success: { bg: colors.successSoft, fg: colors.success },
    info: { bg: colors.accentSoft, fg: colors.accent },
  }[tone];
  return (
    <View
      style={{
        backgroundColor: map.bg,
        borderRadius: radius.md,
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
      <ActivityIndicator color={colors.accent} />
      {label ? (
        <Body size={13} tone="faint">
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
        <Body size={13.5} tone="faint" style={{ textAlign: 'center' }}>
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
  background = colors.canvas,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  background?: string;
  contentStyle?: ViewStyle;
}) {
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: background }, contentStyle]}>{children}</View>;
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
