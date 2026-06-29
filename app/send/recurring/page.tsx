import { ComingSoon } from '@/app/_components/ComingSoon';

export default function RecurringPage() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Send on a schedule."
      blurb="Set up a standing order to your family — same recipient, same amount, every month — and we’ll quietly send it for you while you sleep. Pause, skip, or cancel any time."
      bullets={[
        'Pick any recipient, currency, and cadence (weekly, monthly, or your own).',
        'Lock the rate the moment funds are debited from your wallet — no surprises.',
        'Get a one-tap nudge a day before each send so you can review or skip it.',
        'Failed transfer? It auto-retries the next day and tells you what happened.',
      ]}
    />
  );
}
