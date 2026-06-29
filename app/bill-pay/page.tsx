import { ComingSoon } from '@/app/_components/ComingSoon';

export default function BillPayPage() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Pay their bills, not just their wallet."
      blurb="Send money straight to your family’s electricity, gas, internet, or water provider in India and Pakistan. No copying account numbers, no relying on someone to walk to the office."
      bullets={[
        'Search by provider (K-Electric, SSGC, Tata Power, BSNL, Jio…) and enter their account.',
        'See the bill amount in PKR or INR before you confirm the CAD debit.',
        'Receipts go to both you and the bill-holder — paper trail for everyone.',
        'Save providers per recipient so the second bill takes two taps.',
      ]}
    />
  );
}
