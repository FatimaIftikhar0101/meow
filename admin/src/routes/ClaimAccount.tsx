import { useState, type FormEvent } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Button, Field } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { LIMITS } from '../lib/limits';

/**
 * Turn a six-digit code into an account you can sign in to.
 *
 * Two audiences, one screen, because it is one operation on the server:
 *
 *   - a new colleague claiming the account an administrator just created,
 *     reading the code off that administrator's screen;
 *   - anyone who has forgotten their password and asked for a code by email.
 *
 * Both end at `POST /auth/reset-password`, which sets the password and marks
 * the address verified in the same transaction. That second part is not
 * incidental: staff sign-in requires a verified address, so without it a
 * claimed account still could not get in.
 *
 * On success this signs the person straight in rather than returning them to
 * the sign-in form to retype what they just chose. They land on two-factor
 * enrolment, which is the only place a staff account can go before it is
 * enrolled — so the whole path from "here is your code" to "you are set up"
 * is one sitting.
 */
export default function ClaimAccount({
  onCancel,
  initialEmail = '',
  notice = null,
}: {
  onCancel: () => void;
  /** Carried over when arriving from the sign-in form, so nobody retypes it. */
  initialEmail?: string;
  /** Shown when a code was just requested by email. */
  notice?: string | null;
}) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // The only rule worth checking here. The server never sees this field, so
    // nothing else can catch a typo repeated twice.
    if (password !== confirm) {
      setError('Those two passwords are not the same.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        newPassword: password,
      });
    } catch (err) {
      setError(errorMessage(err, 'Could not set that password.'));
      setBusy(false);
      return;
    }

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      // The password is set — that request succeeded. Only the convenience of
      // being carried through failed, so say which half worked rather than
      // leaving someone unsure whether to use the code again. They cannot: it
      // is spent.
      setError(
        `${errorMessage(err, 'Could not sign in.')} Your password was saved — ` +
          'sign in with it from the previous screen.',
      );
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Set up your account"
      subtitle="Use the six-digit code an administrator gave you, or the one sent to your email address."
    >
      <form onSubmit={onSubmit}>

        {notice && !error && (
          <div className="mb-4">
            <Alert tone="pending">{notice}</Alert>
          </div>
        )}

        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="space-y-4">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={LIMITS.email}
            autoComplete="username"
            autoFocus
            required
          />
          <Field
            label="Setup code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={LIMITS.setupCode}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            required
          />
          <Field
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={LIMITS.newPassword}
            minLength={10}
            autoComplete="new-password"
            hint="At least 10 characters, with an upper case letter, a lower case letter and a digit."
            required
          />
          <Field
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            maxLength={LIMITS.newPassword}
            autoComplete="new-password"
            required
          />
          <Button type="submit" busy={busy} className="w-full">
            Set password and sign in
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-center text-sm text-ink-muted hover:text-ink"
          >
            Back to sign in
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
