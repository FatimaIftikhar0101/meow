import React, { useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { radius, useTheme } from '../theme/tokens';

/**
 * A six-digit one-time code, entered into boxes.
 *
 * It looks like six inputs and behaves like one. Six real `TextInput`s is the
 * obvious build and the wrong one: focus has to be juggled by hand, backspace
 * on an empty box has to be intercepted per-platform, and pasting a code from
 * the SMS or the email drops five of its digits into nowhere. So there is a
 * single transparent input holding the whole string, and the boxes are drawn
 * underneath it. Paste, autofill, backspace and select-all then work because
 * they are the platform's own, not a reimplementation.
 *
 * `autoComplete` and `textContentType` are what let the keyboard offer the code
 * straight from the message. They cost one line and remove the step where
 * somebody switches apps to read six digits and comes back having forgotten the
 * third one.
 */
export function CodeInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  onFilled,
  error = false,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  autoFocus?: boolean;
  /** Fires once the last digit lands, so the caller can submit without a tap. */
  onFilled?: (code: string) => void;
  error?: boolean;
}) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handle = (raw: string) => {
    // Strip anything that is not a digit, so a pasted "123 456" or a code
    // copied with a trailing space still lands correctly.
    const digits = raw.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onFilled?.(digits);
  };

  const boxes = Array.from({ length }, (_, i) => {
    const char = value[i] ?? '';
    // The caret sits on the first empty box, or on the last one when full.
    const active = focused && (i === value.length || (i === length - 1 && value.length === length));
    return (
      <View
        key={i}
        style={{
          flex: 1,
          aspectRatio: 0.78,
          maxWidth: 54,
          borderRadius: radius.md,
          borderWidth: active ? 2 : 1,
          borderColor: error
            ? colors.danger
            : active
              ? colors.accent
              : char
                ? colors.lineStrong
                : colors.line,
          backgroundColor: char ? colors.card : colors.inset,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '600',
            color: error ? colors.danger : colors.ink,
            fontVariant: ['tabular-nums'],
          }}
        >
          {char}
        </Text>
      </View>
    );
  });

  return (
    <Pressable
      accessibilityRole="none"
      onPress={() => input.current?.focus()}
      style={{ position: 'relative' }}
    >
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>{boxes}</View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={handle}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={length}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={`${length}-digit code`}
        // Lets the keyboard offer the code from the message it arrived in.
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        textContentType="oneTimeCode"
        // Invisible, but present and full-size: the real input must stay
        // mounted and hit-testable or the software keyboard closes on Android.
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0,
          color: 'transparent',
          fontSize: 24,
        }}
        caretHidden
      />
    </Pressable>
  );
}
