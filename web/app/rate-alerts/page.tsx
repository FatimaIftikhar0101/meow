import { ComingSoon } from '@/app/_components/ComingSoon';

export default function RateAlertsPage() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Send when the rate is right."
      blurb="Tell us the CAD → PKR or CAD → INR rate you’re waiting for. We’ll watch the market 24/7 and ping you the moment it hits — with a one-tap send right from the alert."
      bullets={[
        'Set a target rate per corridor and a maximum amount to send when it triggers.',
        'See a 30-day mini-chart so you know whether your target is realistic.',
        'Triggers fire as a push notification, an email, or both — your call.',
        'Optional auto-send: when the rate hits, we transfer immediately — no extra tap.',
      ]}
    />
  );
}
