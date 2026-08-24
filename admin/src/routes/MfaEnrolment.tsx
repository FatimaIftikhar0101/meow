import { useMutation } from '@tanstack/react-query';
import QRCode from 'react-qr-code';
import { useState, type FormEvent } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Button, Field } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { LIMITS } from '../lib/limits';

interface Enrolment {
  secret: string;
  uri: string;
}

/**
 * The only screen an un-enrolled staff member can reach.
 *
 * Everything behind StaffGuard returns 403 until this is finished, which is
 * what makes two-factor a requirement of the role rather than a setting.
 *
 * The QR code is rendered from the otpauth URI by the client — the backend
 * returns the URI and the raw secret, and never an image. That keeps an image
 * dependency out of the server, and the secret has to be shown anyway for
 * anyone typing it in by hand.
 */
export default function MfaEnrolment() {
  const { completeEnrolment, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const begin = useMutation({
    mutationFn: async () => (await api.post<Enrolment>('/auth/mfa/enrol')).data,
    onError: (err) => setError(errorMessage(err, 'Could not start enrolment.')),
  });

  const confirm = useMutation({
    mutationFn: async (value: string) =>
      (await api.post<{ recoveryCodes: string[] }>('/auth/mfa/confirm', {
        code: value,
      })).data,
    onSuccess: (data) => setRecoveryCodes(data.recoveryCodes),
    onError: (err) => {
      setError(errorMessage(err, 'That code was not accepted.'));
      setCode('');
    },
  });

  function onConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    confirm.mutate(code);
  }

  // Shown once and never again — the server keeps only hashes.
  if (recoveryCodes) {
    return (
      <Centered>
        <h1 className="font-display text-xl text-ink">Save your recovery codes</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Each one works once, if you lose your phone. This is the only time
          they are shown — the server keeps only hashes of them.
        </p>
        <ul className="tabular my-5 grid grid-cols-2 gap-2 rounded-lg bg-inset p-4 text-sm text-ink">
          {recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}
        <Button
          className="w-full"
          busy={leaving}
          onClick={() => {
            setError(null);
            setLeaving(true);
            void completeEnrolment()
              .catch(() =>
                setError(
                  'Two-factor is set up, but the panel could not confirm it. ' +
                    'Reload the page.',
                ),
              )
              .finally(() => setLeaving(false));
          }}
        >
          I have saved them
        </Button>
      </Centered>
    );
  }

  if (!begin.data) {
    return (
      <Centered>
        <h1 className="font-display text-xl text-ink">Set up two-factor</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every back-office account needs an authenticator app. Until this is
          done, nothing else in the panel will open.
        </p>
        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}
        <Button
          className="mt-5 w-full"
          busy={begin.isPending}
          onClick={() => begin.mutate()}
        >
          Begin
        </Button>
        <SignOutLink onClick={signOut} />
      </Centered>
    );
  }

  return (
    <Centered>
      <h1 className="font-display text-xl text-ink">Scan this</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Add it to your authenticator app, then enter the code it shows.
      </p>

      {/* White plate regardless of theme: a QR reader needs light modules on a
          dark ground, and inverting it is the classic way to ship a code that
          no phone will read. */}
      {/* Literally white, and it stays white in dark mode. A QR code is read by
          a camera, not a person: scanners expect dark modules on a light
          ground, and inverting one is the single most common reason a code
          will not scan. The quiet zone around it is part of the spec too, which
          is what the padding is for. */}
      <div className="my-5 flex justify-center rounded-lg bg-white p-4">
        <QRCode
          value={begin.data.uri}
          size={176}
          // Rendered here rather than fetched as an image, so the secret never
          // travels to a third-party chart server — which is what most QR
          // "APIs" are, and would hand the second factor to a stranger.
          level="M"
          bgColor="#FFFFFF"
          fgColor="#3C3C3C"
        />
      </div>

      <details className="mb-4">
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
          Cannot scan it?
        </summary>
        <p className="mt-2 text-xs text-ink-muted">
          Enter this key by hand instead:
        </p>
        <p className="tabular mt-1 rounded-lg bg-inset p-3 font-mono text-sm break-all text-ink">
          {begin.data.secret}
        </p>
      </details>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <form onSubmit={onConfirm} className="space-y-4">
        <Field
          label="Code from the app"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={LIMITS.mfaCode}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          autoFocus
          required
        />
        <Button type="submit" busy={confirm.isPending} className="w-full">
          Confirm
        </Button>
      </form>
      <SignOutLink onClick={signOut} />
    </Centered>
  );
}

/**
 * Enrolment shares the sign-in frame. It is the third screen a new colleague
 * sees and the second one they see before they have an account they can use,
 * so it should not look like it belongs to a different product.
 */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <AuthLayout>{children}</AuthLayout>
  );
}

function SignOutLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full text-center text-sm text-ink-muted hover:text-ink"
    >
      Sign out
    </button>
  );
}
