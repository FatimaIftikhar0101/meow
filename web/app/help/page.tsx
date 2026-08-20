import { ComingSoon } from '@/app/_components/ComingSoon';

export default function HelpPage() {
  return (
    <ComingSoon
      eyebrow="Help centre"
      title="Answers, fast."
      blurb="Step-by-step guides for everything — KYC, sending money, adding recipients, reading your statement, and understanding FX rates. Launching alongside our full support team."
      bullets={[
        'KYC walkthrough: what documents we accept and how long verification takes.',
        'Sending money: corridors, limits, fees, and how the rate is locked.',
        'Recipients: adding bank accounts, IBANs, and mobile wallets.',
        'Statements & receipts: downloading your transaction history as a PDF.',
        'Rate locking: how the FX rate is guaranteed from tap-to-deliver.',
      ]}
    />
  );
}
