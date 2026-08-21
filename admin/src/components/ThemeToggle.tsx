import { useThemePreference, type ThemePreference } from '../lib/theme';

const OPTIONS: { value: ThemePreference; label: string; title: string }[] = [
  { value: 'system', label: 'Auto', title: 'Follow this computer’s setting' },
  { value: 'light', label: 'Light', title: 'Always light' },
  { value: 'dark', label: 'Dark', title: 'Always dark' },
];

/**
 * Three states, not a switch.
 *
 * "Auto" is the default and has to stay expressible: a switch can only say
 * light or dark, so choosing one would silently opt everybody out of the
 * scheduled switch their machine already does at sunset. It is also the only
 * setting that behaves correctly for a shared operations workstation, where the
 * OS preference is the house style and the panel should not argue with it.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useThemePreference();
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="flex gap-0.5 rounded-lg bg-card p-0.5"
    >
      {OPTIONS.map((o) => {
        const on = preference === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => setPreference(o.value)}
            className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              on
                ? 'bg-accent text-on-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
