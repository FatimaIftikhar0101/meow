import { ComingSoon } from '@/app/_components/ComingSoon';

export default function MobileRechargePage() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Top up their phone in seconds."
      blurb="Drop airtime or a data pack straight onto a Jazz, Telenor, Zong, Ufone, Jio, Airtel, or Vi number — paid in CAD, delivered instantly in PKR or INR."
      bullets={[
        'Save the numbers you recharge most — your mum, your siblings, your in-laws.',
        'Pick from the carrier’s real bundles (5 GB, 30-day calls, social-only packs).',
        'Set a recurring monthly recharge so they never run out mid-month.',
        'Get a receipt + carrier confirmation — every time.',
      ]}
    />
  );
}
