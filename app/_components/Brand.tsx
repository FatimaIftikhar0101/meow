import Link from 'next/link';

export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" width={size} height={size}>
        <defs>
          <linearGradient id="brand-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff1c2" />
            <stop offset="60%" stopColor="#e0b259" />
            <stop offset="100%" stopColor="#9a6d18" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="15" fill="none" stroke="url(#brand-gold)" strokeWidth="1.5" />
        {/* minimalist cat silhouette */}
        <path
          d="M 11 11 L 13 8 L 14 13 L 18 13 L 19 8 L 21 11 Q 23 16 21 20 Q 16 23 11 20 Q 9 16 11 11 Z"
          fill="url(#brand-gold)"
        />
        <circle cx="13.5" cy="15" r="0.9" fill="#07090f" />
        <circle cx="18.5" cy="15" r="0.9" fill="#07090f" />
      </svg>
    </span>
  );
}

export function BrandWordmark({ size = 24 }: { size?: number }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 group">
      <BrandMark size={size} />
      <span className="text-base font-bold tracking-[0.18em] uppercase text-[var(--foreground)] group-hover:text-[var(--accent)] transition">
        Meow
      </span>
    </Link>
  );
}
