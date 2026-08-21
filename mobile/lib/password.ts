/**
 * The password rules, in one place.
 *
 * These mirror the server's `RegisterDto` / `ResetPasswordDto` exactly. They
 * lived in two screens as two copies, and a third was about to be written for
 * the reset screen — at which point one of them drifts from the DTO and
 * somebody is told their password is fine right up until the server refuses it.
 *
 * Client-side checking is a courtesy, not a control: the server validates
 * regardless. The point is that the refusal happens before the round trip,
 * next to the field, instead of arriving as a red banner afterwards.
 */
export const PASSWORD_RULES = [
  { label: 'At least 10 characters', test: (p: string) => p.length >= 10 },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A number', test: (p: string) => /[0-9]/.test(p) },
] as const;

export function unmetRules(password: string) {
  return PASSWORD_RULES.filter((r) => !r.test(password));
}
