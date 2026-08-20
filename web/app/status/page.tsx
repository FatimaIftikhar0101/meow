import { ComingSoon } from '@/app/_components/ComingSoon';

export default function StatusPage() {
  return (
    <ComingSoon
      eyebrow="System status"
      title="Everything running smoothly."
      blurb="A real-time view of every part of the Meow network — deposits, FX conversion, and payouts per corridor. If something's slow or down, you'll see it here before we even tweet about it."
      bullets={[
        'Per-corridor payout health: CAD → PKR, CAD → INR, and all future lanes.',
        'FX engine uptime and last-rate-fetch timestamp.',
        'Wallet deposit processing and bank-rail status.',
        'Incident history with resolution notes — full transparency, no spin.',
      ]}
    />
  );
}
