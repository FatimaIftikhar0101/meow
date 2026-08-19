import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';

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
  const { refresh, signOut } = useAuth();
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
        <Button className="w-full" onClick={() => void refresh()}>
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

      <div className="my-5 rounded-lg bg-inset p-4">
        <p className="text-xs text-ink-muted">
          Cannot scan? Enter this key by hand:
        </p>
        <p className="tabular mt-1 font-mono text-sm break-all text-ink">
          {begin.data.secret}
        </p>
      </div>

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

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-inset px-4">
      <Card className="w-full max-w-sm p-8">{children}</Card>
    </div>
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
