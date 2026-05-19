import Link from 'next/link';

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] text-white"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden="true"
    >
      🐱
    </span>
  );
}

export function BrandWordmark({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2 group">
      <BrandMark size={size} />
      <span className="text-xl font-bold tracking-tight text-[var(--brand-deep)] group-hover:text-[var(--brand)] transition">
        Meow
      </span>
    </Link>
  );
}
