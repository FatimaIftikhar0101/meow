import { Image } from 'expo-image';
import React from 'react';

/**
 * The Meow mark, as supplied by the client.
 *
 * This replaces `CatMark` — the drawn gold cat — everywhere the mark stands in
 * for the brand: the welcome screen, the greeting, and the home header. The
 * artwork is a photograph, so unlike the vector it cannot be redrawn per size;
 * it is one 512px source scaled down, which covers a 76pt placement at 3x
 * density with room to spare.
 *
 * `CatMark` has deliberately not been deleted. It still draws the marker that
 * rides the corridor arc in `WorldMap`, at 22pt, where this artwork would be an
 * orange smudge — and where the mark is doing a map pin's job rather than a
 * logo's. Two marks in one app is normally a mistake; this is the case where
 * the small one is a different instrument, not a smaller copy of the same one.
 *
 * What is lost in the swap is `eyesClosed`: the drawn cat shut its eyes after
 * dark, on the home header and in the greeting. A photograph cannot, so the
 * night state is now carried by the copy and the scheme alone.
 */
export function Logo({
  size,
  accessibilityLabel,
}: {
  size: number;
  /** Omitted where the mark sits beside the wordmark or a greeting that
   *  already names the product — a second announcement is noise. */
  accessibilityLabel?: string;
}) {
  return (
    <Image
      source={require('../assets/logo.png')}
      style={{ width: size, height: size }}
      // The artwork is square and already framed by its own ring, so it is
      // scaled whole rather than cropped to fill.
      contentFit="contain"
      // It never changes, so it never needs to fade in.
      transition={0}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessible={accessibilityLabel != null}
    />
  );
}
