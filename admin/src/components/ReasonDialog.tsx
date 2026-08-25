import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from './ui';
import { LIMITS } from '../lib/limits';

/**
 * Asking a staff member why, in a way that can hold them to the answer.
 *
 * Every audited write in this panel — suspending a customer, revealing an
 * account number, overturning a KYC decision, changing a colleague's role —
 * carries a mandatory `reason`, bounded server-side at three characters to
 * either 200 or 300 depending on the module. All ten of them collected it
 * through `window.prompt()`.
 *
 * That worked, in the narrow sense. It is not broken on the desktop build:
 * wry never calls `SetAreDefaultScriptDialogsEnabled`, so WebView2's own
 * dialog appears. The problem is that a `prompt()` cannot carry a bound. There
 * is nowhere to put a `maxLength`, nowhere to put the minimum, and nowhere to
 * say what the field is for. So the only way to discover that 240 characters
 * is too many is to type them, press OK, and read a validation error about a
 * field that is no longer on screen — with the sentence gone.
 *
 * For the reason field specifically that is the wrong failure. It is the part
 * of the audit record a reviewer reads, the part that answers "should they
 * have done this", and the moment someone is most likely to write something
 * long. Losing it to a round trip teaches people to write "ok" instead, which
 * is a compliance problem wearing a UX problem's clothes.
 *
 * So: a real dialog, with the bound visible, the count visible near the
 * ceiling, and the confirm button disabled until the text would actually be
 * accepted. It is deliberately promise-shaped —
 *
 *     const reason = await askReason({ question: '…' });
 *     if (!reason) return;
 *
 * — because that is exactly the shape of the ten call sites it replaces, so
 * converting them changes the word `window.prompt` and nothing else about
 * their control flow. Cancelling resolves `null`, same as `prompt()`.
 */

interface AskOptions {
  /** The question. Phrased as a question, because it is one. */
  question: string;
  /** Overrides "Confirm" where a verb reads better on the button. */
  confirmLabel?: string;
  /** Renders the confirm button in the danger variant. */
  destructive?: boolean;
  /**
   * The server's bound for *this* action's reason. Defaults to the stricter
   * `@Length(3, 200)` that most DTOs declare; the screening endpoints accept
   * 300 and say so at the call site. Never guess it — a cap tighter than the
   * server's silently costs someone the end of their sentence.
   */
  maxLength?: number;
  /**
   * One extra yes/no the action needs, asked in the same breath as the reason.
   *
   * Deliberately at most one, and deliberately a checkbox. This is a reason
   * dialog that tolerates a single rider — "and email them a copy" — not a
   * general form builder. An action needing more than that has outgrown this
   * component and should have a screen.
   */
  checkbox?: { label: string; defaultChecked?: boolean };
}

interface Answer {
  reason: string;
  /** The checkbox's final state, or false when none was offered. */
  checked: boolean;
}

type AskFull = (options: AskOptions) => Promise<Answer | null>;

const ReasonContext = createContext<AskFull | null>(null);

function useAsk(): AskFull {
  const ask = useContext(ReasonContext);
  if (!ask) {
    throw new Error('useAskReason must be used inside <ReasonDialogProvider>');
  }
  return ask;
}

/**
 * The common case: just the reason, resolving to the text or null.
 *
 * Kept as its own hook so the nine call sites that ask nothing else are not
 * made to unwrap an object for a field they will never read.
 */
export function useAskReason(): (
  options: AskOptions,
) => Promise<string | null> {
  const ask = useAsk();
  return useCallback(
    async (options) => (await ask(options))?.reason ?? null,
    [ask],
  );
}

/** For the one action that also needs the rider answered. */
export function useAskReasonWithOption(): AskFull {
  return useAsk();
}

export function ReasonDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<AskOptions | null>(null);
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  /**
   * The other half of the promise, parked until the person answers.
   *
   * A ref rather than state: resolving must not depend on a re-render having
   * happened, and replacing this value should never itself schedule one.
   */
  const resolver = useRef<((value: Answer | null) => void) | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const ask = useCallback<AskFull>((options) => {
    return new Promise((resolve) => {
      // Two dialogs at once should be impossible — every call site awaits —
      // but if one ever happened, the first caller must not be left hanging
      // on a promise nobody will settle.
      resolver.current?.(null);
      resolver.current = resolve;
      setText('');
      setChecked(options.checkbox?.defaultChecked ?? false);
      setOpen(options);
    });
  }, []);

  const settle = useCallback((value: Answer | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOpen(null);
    setText('');
    setChecked(false);
    resolve?.(value);
  }, []);

  // Escape closes, like every other dialog on the machine.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, settle]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const max = open?.maxLength ?? LIMITS.reason;
  const trimmed = text.trim();
  // Trimmed, because the server trims nothing and " ok " is three characters
  // that say nothing. Matching the server's own bound would let a reason
  // through here and fail it there.
  const valid = trimmed.length >= LIMITS.reasonMin && trimmed.length <= max;

  return (
    <ReasonContext.Provider value={ask}>
      {children}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          // Clicking the backdrop cancels; clicking the card must not.
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) settle(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reason"
            className="w-full max-w-md rounded-xl border border-line bg-card p-5 shadow-lg"
          >
            <p className="text-sm leading-relaxed text-ink">{open.question}</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) settle({ reason: trimmed, checked });
              }}
            >
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  // Enter submits, Shift+Enter breaks the line. A textarea is
                  // here for the second case — reasons run to a sentence or
                  // two — but the common case is one line and a keypress.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (valid) settle({ reason: trimmed, checked });
                  }
                }}
                rows={3}
                maxLength={max}
                placeholder="Recorded against your name."
                className="mt-3 w-full resize-none rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />

              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-xs text-ink-muted">
                  {trimmed.length > 0 && trimmed.length < LIMITS.reasonMin
                    ? `At least ${LIMITS.reasonMin} characters.`
                    : 'Part of the permanent audit record.'}
                </span>
                {/* Silent until it is nearly relevant. A counter sitting at
                    3/200 from the first keystroke is noise on a field almost
                    nobody will fill. */}
                {text.length > max - 40 && (
                  <span className="tabular text-xs text-ink-muted">
                    {text.length}/{max}
                  </span>
                )}
              </div>

              {open.checkbox && (
                <label className="mt-4 flex items-start gap-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    className="mt-0.5 size-4 accent-accent"
                  />
                  {open.checkbox.label}
                </label>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => settle(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={open.destructive ? 'danger' : 'primary'}
                  disabled={!valid}
                >
                  {open.confirmLabel ?? 'Confirm'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ReasonContext.Provider>
  );
}
