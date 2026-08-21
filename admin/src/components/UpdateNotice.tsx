import { useDesktopUpdate } from '../lib/updates';

/**
 * "A new version is ready" — in the sidebar, above the account block.
 *
 * Not a modal and not a toast. Somebody is on a call with a customer, or
 * halfway through a form that demands a reason for the audit log; installing
 * restarts the app and loses that. So it sits where they will see it when they
 * next look up, and waits.
 *
 * It renders nothing at all when there is no update, when the updater has not
 * been configured yet, or in a browser tab — a panel that nags about its own
 * broken updater on every launch teaches its users to ignore the sidebar.
 */
export function UpdateNotice() {
  const update = useDesktopUpdate();

  if (!update.supported || !update.available) return null;

  const pct =
    update.progress === null ? null : Math.round(update.progress * 100);

  return (
    <div className="mx-3 mb-3 rounded-lg bg-accent-soft p-3">
      <p className="text-xs font-medium text-ink">Version {update.available.version} is ready</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {update.installing
          ? pct === null
            ? 'Downloading…'
            : `Downloading… ${pct}%`
          : 'Installing restarts the panel.'}
      </p>

      {update.error && <p className="mt-1.5 text-xs text-danger">{update.error}</p>}

      <button
        onClick={() => void update.install()}
        disabled={update.installing}
        className="mt-2 w-full rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-on-accent transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {update.installing ? 'Installing…' : 'Install and restart'}
      </button>
    </div>
  );
}
