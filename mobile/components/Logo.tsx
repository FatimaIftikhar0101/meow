import { Image } from 'expo-image';
import React from 'react';

/**
 * The Meow mark, as supplied by the client.
 *
 * This replaces `CatMark` — the drawn gold cat — wherever the photographic
 * brand mark is wanted: the welcome screen, greeting, home header, and map
 * transfer marker. The artwork is a photograph, so unlike the vector it cannot
 * be redrawn per size; it is one 512px source scaled down, which covers a 76pt
 * placement at 3x density with room to spare.
 *
 * `CatMark` remains available for legacy lockups, but map markers now use this
 * exact asset so the brand has one recognisable cat across the client.
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
