import { useState, type FormEvent } from 'react';
import { Alert, Button, Field } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';

/**
 * Sign-in, in its two halves.
 *
 * The password step and the code step are one screen rather than two routes
 * because the state between them is not a page anybody can navigate to — it
 * is a five-minute challenge held in memory. A route would imply it survives
 * a reload, and it does not.
 */
export default function SignIn() {
  const { status, signIn, submitMfaCode, cancelMfa, signOutWarning } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const awaitingCode = status === 'mfaRequired';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (awaitingCode) {
        await submitMfaCode(code);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in.'));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-inset px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-line bg-card p-8"
      >
        <div className="mb-6">
          <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-roundel">
            <span className="font-display text-lg text-gold">M</span>
          </div>
          <h1 className="font-display text-xl text-ink">
            {awaitingCode ? 'Two-factor code' : 'Meow back office'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {awaitingCode
              ? 'Enter the six-digit code from your authenticator app, or one of your recovery codes.'
              : 'Staff access only.'}
          </p>
        </div>

        {signOutWarning && !error && (
          <div className="mb-4">
            <Alert tone="pending">{signOutWarning}</Alert>
          </div>
        )}

        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {awaitingCode ? (
          <div className="space-y-4">
            <Field
              label="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              required
            />
            <Button type="submit" busy={busy} className="w-full">
              Verify
            </Button>
            <button
              type="button"
              onClick={cancelMfa}
              className="w-full text-center text-sm text-ink-muted hover:text-ink"
            >
              Start again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" busy={busy} className="w-full">
              Sign in
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
