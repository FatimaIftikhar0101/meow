import {
  STAGES,
  STATUS_LABEL,
  stageIndexOf,
  type TransferStatus,
} from '../lib/transfers';

/**
 * Where a transfer has got to, as a shape rather than a sentence.
 *
 * A transfer is a position in a fixed six-stage machine, and the queue was
 * throwing that away. A pill reading "Compliance check" names the stage and
 * says nothing about how far along that is or what is still to come — so
 * comparing two rows meant reading two labels and knowing the running order by
 * heart. Down a column of forty rows that is the whole job, done slowly.
 *
 * Six ticks, filled to where the money is. Position carries the progress,
 * colour carries the trouble, and the same glyph works at a glance from a
 * metre away and under inspection up close. It is the journey the customer
 * sees on their phone, compressed to something that belongs in a table — the
 * information, not the mascot.
 *
 * A failed or cancelled transfer stops where it stopped: the run is drawn up
 * to the last stage it actually reached and the remainder is left open, with
 * the break marked. Filling all six would say it finished.
 */

export function StageRail({
  status,
  reachedIndex,
  overdue = false,
  size = 'sm',
}: {
  status: TransferStatus;
  /**
   * For a broken transfer, the last stage it actually reached. `failed` and
   * `cancelled` are outcomes rather than places, so without this the rail has
   * nowhere to stand.
   */
  reachedIndex?: number;
  overdue?: boolean;
  size?: 'sm' | 'lg';
}) {
  const broken = status === 'failed' || status === 'cancelled';
  const own = stageIndexOf(status);
  const at = broken ? (reachedIndex ?? 0) : own === -1 ? 0 : own;
  const done = status === 'delivered';

  const tick = size === 'lg' ? 'h-1.5' : 'h-1';
  const gap = size === 'lg' ? 'gap-1' : 'gap-[3px]';
  const width = size === 'lg' ? 'w-6' : 'w-3';

  // One sentence, because a screen reader gets nothing from six divs. The
  // label says the stage and the position, which is exactly what the shape
  // says to someone who can see it.
  const label = broken
    ? `${STATUS_LABEL[status]} at stage ${at + 1} of ${STAGES.length}`
    : `${STATUS_LABEL[status]}, stage ${at + 1} of ${STAGES.length}`;

  const fill = broken
    ? 'bg-danger'
    : done
      ? 'bg-success'
      : overdue
        ? 'bg-danger'
        : 'bg-accent';

  return (
    <span
      className={`inline-flex items-center ${gap}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {STAGES.map((stage, i) => (
        <span
          key={stage}
          aria-hidden
          className={`${tick} ${width} rounded-full transition-colors ${
            i <= at ? fill : 'bg-line-strong'
          }`}
        />
      ))}
    </span>
  );
}
