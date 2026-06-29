import { ComingSoon } from '@/app/_components/ComingSoon';

export default function ReferPage() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Send for free when you bring a friend."
      blurb="Share your code with someone who hasn't tried Meow yet. They get their first transfer with zero fees, you get $15 in wallet credit the moment their first transfer settles. No cap on how many friends."
      bullets={[
        'A short, memorable code (we’ll let you customise it) — share it anywhere.',
        'Track every invite: who signed up, who verified, who sent — and your live balance of pending credit.',
        'Optional milestone bonus — refer 5 friends in a month, get a $100 bump.',
        'Family-circle codes that split the credit with the recipient when they receive a transfer.',
      ]}
    />
  );
}
