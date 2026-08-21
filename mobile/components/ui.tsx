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
import { PASSWORD_RULES, unmetRules } from '../lib/password';
import { radius, shadow, space, useTheme, type Scheme } from '../theme/tokens';

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

/**
 * A tone resolved against the scheme in force.
 *
 * This was a module-level map, which worked exactly as long as there was one
 * scheme. A colour captured at import time cannot follow a theme change, so
 * every tone is now looked up per render.
 */
function toneColor(colors: Scheme, tone: TextTone): string {
  return {
    ink: colors.ink,
    muted: colors.inkMuted,
    faint: colors.inkFaint,
    accent: colors.accent,
    success: colors.success,
    pending: colors.pending,
    danger: colors.danger,
    onSlab: colors.onSlab,
    onSlabMuted: colors.onSlabMuted,
  }[tone];
}

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
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: size,
          fontWeight: '700',
          letterSpacing: -size * 0.026,
          color: toneColor(colors, tone),
        },
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
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: size,
          fontWeight: weight,
          color: toneColor(colors, tone),
          lineHeight: size * 1.45,
        },
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
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.7,
        textTransform: 'uppercase',
        color: toneColor(colors, tone),
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
  const { colors } = useTheme();
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
  const { colors } = useTheme();
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
  colors: Scheme,
  variant: Variant,
  onSlab: boolean,
): { bg: string; fg: string; border: string } {
  if (onSlab) {
    switch (variant) {
      case 'primary':
        // slabDeep, not accentDeep. This button is white-on-slab, and the
        // scheme's own deep accent inverts in dark mode — #CBD6DB on white is
        // 1.48:1, a button with no visible label. The slab's own deep tone is
        // dark in both schemes, which is the property this needs.
        return { bg: colors.onSlab, fg: colors.slabDeep, border: colors.onSlab };
      case 'secondary':
        return { bg: 'rgba(255,255,255,0.14)', fg: colors.onSlab, border: 'transparent' };
      case 'outline':
        return { bg: 'transparent', fg: colors.onSlab, border: 'rgba(255,255,255,0.34)' };
      case 'ghost':
        return { bg: 'transparent', fg: colors.onSlab, border: 'transparent' };
      case 'danger':
        return {
          bg: 'transparent',
          fg: colors.onSlabDanger,
          border: colors.onSlabDanger,
        };
    }
  }
  switch (variant) {
    case 'primary':
      return { bg: colors.accent, fg: colors.onAccent, border: colors.accent };
    case 'secondary':
      return { bg: colors.inset, fg: colors.ink, border: colors.inset };
    case 'outline':
      // Same reasoning as the text field: an outline button on a ground its
      // own colour is identified by its border and nothing else.
      return { bg: colors.card, fg: colors.ink, border: colors.fieldBorder };
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
  const { colors } = useTheme();
  const v = variantStyle(colors, variant, onSlab);
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
  const { colors } = useTheme();
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
            // fieldBorder, not the hairline: this outline is the only thing
            // marking where the field is, since its ground matches the page.
            borderColor: error ? colors.danger : focused ? colors.accent : colors.fieldBorder,
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
  const { colors } = useTheme();
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
  const { colors } = useTheme();
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
  background,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Overrides the canvas — for a screen that sits on a slab, say. */
  background?: string;
  contentStyle?: ViewStyle;
}) {
  const { colors } = useTheme();
  // Resolved here rather than in the default parameter: a default that reads a
  // module-level colour is evaluated against whichever scheme was loaded first.
  const bg = background ?? colors.canvas;
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: bg }, contentStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
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

/* ── Password checklist ────────────────────────────────────────────────── */

/**
 * The unmet-rules list shown under a new-password field.
 *
 * Renders nothing until there is something to type against and something still
 * unmet, so an empty field is not greeted by four red crosses — the rules are
 * guidance while typing, not an accusation before starting.
 */
export function PasswordChecklist({ password }: { password: string }) {
  if (!password.length || !unmetRules(password).length) return null;
  return (
    <View style={{ gap: 4, marginTop: -6 }}>
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <Row key={r.label} gap={7}>
            <Body size={12} tone={ok ? 'accent' : 'faint'}>
              {ok ? '✓' : '○'}
            </Body>
            <Body size={12} tone={ok ? 'accent' : 'faint'}>
              {r.label}
            </Body>
          </Row>
        );
      })}
    </View>
  );
}
