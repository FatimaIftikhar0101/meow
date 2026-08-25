import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Empty, Field, PageHeader, Pill } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL, type StaffRole } from '../lib/permissions';
import {
  useAskReason,
  useAskReasonWithOption,
} from '../components/ReasonDialog';
import { LIMITS } from '../lib/limits';

interface StaffMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: StaffRole;
  suspended: boolean;
  emailVerified: boolean;
  pending: boolean;
  createdAt: string;
}

const ROLES: StaffRole[] = ['support', 'operations', 'compliance', 'admin'];

/**
 * Who works here, and what they may do.
 *
 * Every action on this screen demands a reason, because the server does — the
 * audit writer will not accept a staff action without one. The field is not a
 * formality: it is what a compliance-programme review reads back.
 */
export default function Staff() {
  const qc = useQueryClient();
  const askReason = useAskReason();
  const askReasonWithOption = useAskReasonWithOption();
  const { profile, can } = useAuth();
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get<StaffMember[]>('/staff')).data,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff'] });

  const assignRole = useMutation({
    mutationFn: async (v: { id: string; role: StaffRole; reason: string }) =>
      api.patch(`/staff/${v.id}/role`, { role: v.role, reason: v.reason }),
    onSuccess: invalidate,
    onError: (e) => setError(errorMessage(e, 'Could not change that role.')),
  });

  const setActive = useMutation({
    mutationFn: async (v: { id: string; active: boolean; reason: string }) =>
      api.post(`/staff/${v.id}/${v.active ? 'reactivate' : 'deactivate'}`, {
        reason: v.reason,
      }),
    onSuccess: invalidate,
    onError: (e) => setError(errorMessage(e, 'Could not change that account.')),
  });

  /**
   * A reissued code lands in the same card the invitation used, above the
   * list. It is shown once and cannot be looked up again, so it must not be
   * something a stray click dismisses — hence a panel the admin closes by
   * saying they have passed it on, rather than a toast.
   */
  const [reissued, setReissued] = useState<InviteResult | null>(null);

  const reissue = useMutation({
    mutationFn: async (v: { id: string; reason: string; sendEmail: boolean }) =>
      (
        await api.post<InviteResult>(`/staff/${v.id}/reissue`, {
          reason: v.reason,
          sendEmail: v.sendEmail,
        })
      ).data,
    onSuccess: (result) => {
      setReissued(result);
      invalidate();
    },
    onError: (e) =>
      setError(errorMessage(e, 'Could not issue a new setup code.')),
  });

  async function onReissue(member: StaffMember) {
    const answer = await askReasonWithOption({
      question: `Why does ${member.email} need a new setup code? The old one stops working immediately.`,
      confirmLabel: 'Issue new code',
      // Defaulted on, unlike the invitation. An invite is usually created with
      // the new colleague in the room; a reissue almost never is — the reason
      // there is a second code at all is that the first one did not reach
      // somebody in time.
      checkbox: { label: 'Email a copy as well', defaultChecked: true },
    });
    if (!answer) return;
    setError(null);
    setReissued(null);
    reissue.mutate({
      id: member.id,
      reason: answer.reason,
      sendEmail: answer.checked,
    });
  }

  async function onChangeRole(member: StaffMember, role: StaffRole) {
    const reason = await askReason({
      question: `Why is ${member.email} becoming ${ROLE_LABEL[role]}?`,
      confirmLabel: 'Change role',
    });
    if (!reason) return;
    setError(null);
    assignRole.mutate({ id: member.id, role, reason });
  }

  async function onToggleActive(member: StaffMember) {
    const verb = member.suspended ? 'reactivating' : 'deactivating';
    const reason = await askReason({
      question: `Why are you ${verb} ${member.email}?`,
      confirmLabel: member.suspended ? 'Reactivate' : 'Deactivate',
      destructive: !member.suspended,
    });
    if (!reason) return;
    setError(null);
    setActive.mutate({ id: member.id, active: member.suspended, reason });
  }

  return (
    <>
      <PageHeader
        title="Staff & roles"
        subtitle="Back-office accounts. Every change here is recorded with a reason."
        action={
          can('staff.write') && (
            <Button onClick={() => setInviting((v) => !v)}>
              {inviting ? 'Cancel' : 'Invite someone'}
            </Button>
          )
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {inviting && (
        <InviteForm onInvited={invalidate} onClose={() => setInviting(false)} />
      )}

      {reissued && (
        <InviteCode
          result={reissued}
          reissue
          onClose={() => setReissued(null)}
        />
      )}

      <Card>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : !data?.length ? (
          <Empty>No staff accounts yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((m) => {
                const isSelf = m.id === profile?.userId;
                return (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-ink">
                      {m.email}
                      {isSelf && (
                        <span className="ml-2 text-xs text-ink-faint">you</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {can('role.assign') && !isSelf ? (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            onChangeRole(m, e.target.value as StaffRole)
                          }
                          className="rounded-lg border border-field-border bg-card px-2 py-1 text-sm text-ink"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-ink-muted">
                          {ROLE_LABEL[m.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.suspended ? (
                        <Pill tone="danger">Deactivated</Pill>
                      ) : m.pending ? (
                        // An invitation that was never taken up. Worth showing
                        // rather than discovering months later.
                        <Pill tone="pending">Invite not claimed</Pill>
                      ) : (
                        <Pill tone="success">Active</Pill>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        {/* Only where it can do anything. A claimed account has
                            a password, so the server refuses — offering the
                            button anyway would just be an error waiting to
                            happen. Suspended accounts must be reactivated
                            first, for the same reason. */}
                        {can('staff.write') && m.pending && !m.suspended && (
                          <button
                            onClick={() => void onReissue(m)}
                            disabled={reissue.isPending}
                            className="text-xs text-accent underline hover:text-accent-deep disabled:opacity-50"
                          >
                            Resend setup code
                          </button>
                        )}
                        {can('staff.write') && !isSelf && (
                          <button
                            onClick={() => void onToggleActive(m)}
                            className="text-xs text-ink-muted underline hover:text-ink"
                          >
                            {m.suspended ? 'Reactivate' : 'Deactivate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

interface InviteResult {
  email: string;
  setupCode: string;
  expiresInMinutes: number;
  emailed: boolean;
  emailError: string | null;
}

function InviteForm({
  onInvited,
  onClose,
}: {
  onInvited: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('support');
  const [reason, setReason] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  const invite = useMutation({
    mutationFn: async () =>
      (
        await api.post<InviteResult>('/staff/invite', {
          email: email.trim(),
          role,
          reason,
          sendEmail,
        })
      ).data,
    onSuccess: (data) => {
      setResult(data);
      onInvited();
    },
    onError: (e) => setError(errorMessage(e, 'Could not create that account.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    invite.mutate();
  }

  if (result) return <InviteCode result={result} onClose={onClose} />;

  return (
    <Card className="mb-5 p-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-ink-muted">
          You will be given a six-digit setup code to pass to them directly.
          Nothing is emailed, and no password is set here — they choose their
          own and enrol in two-factor when they use the code.
        </p>
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={LIMITS.email}
            required
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Field
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="Recorded in the audit log. Whoever reviews it will not accept “they asked”."
          minLength={LIMITS.reasonMin}
          maxLength={LIMITS.reason}
          required
        />
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="mt-0.5 size-4 accent-accent"
          />
          <span className="text-sm text-ink">
            Email the code to them as well
            <span className="mt-0.5 block text-xs text-ink-muted">
              For someone not in the room. You still get the code on screen, so
              a message that lands in spam delays them rather than locking them
              out.
            </span>
          </span>
        </label>
        <Button type="submit" busy={invite.isPending}>
          Create account
        </Button>
      </form>
    </Card>
  );
}

/**
 * The one time this code is ever visible.
 *
 * It is stored as a bcrypt hash the moment it is created, so nothing — not
 * this panel, not the database, not a support engineer — can read it back.
 * Closing this card without passing it on means creating the account again.
 * Hence the deliberate friction on the button, and the size of the digits:
 * this is read aloud or typed into a chat window, not clicked through.
 */
function InviteCode({
  result,
  onClose,
  reissue = false,
}: {
  result: InviteResult;
  onClose: () => void;
  /** Same card, different first sentence: nothing was created this time. */
  reissue?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.setupCode);
      setCopied(true);
    } catch {
      // Clipboard access can be refused, and the code is on screen anyway.
      setCopied(false);
    }
  }

  return (
    <Card className="mb-5 p-5">
      <h3 className="font-display text-lg text-ink">
        {reissue
          ? `New setup code for ${result.email}`
          : `Account created for ${result.email}`}
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        Give them this code. It is shown once and cannot be looked up again.
        {reissue && ' Any code issued earlier has stopped working.'}
      </p>

      <div className="my-5 flex items-center gap-4">
        <span className="font-mono text-3xl tracking-[0.3em] text-ink">
          {result.setupCode}
        </span>
        <Button variant="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {result.emailed && (
        <div className="mb-4">
          <Alert tone="success">
            A copy was emailed to {result.email}. Pass the code on anyway — mail
            without a verified domain is often filtered.
          </Alert>
        </div>
      )}
      {result.emailError && (
        <div className="mb-4">
          <Alert>
            The account was created, but the email could not be sent — “
            {result.emailError}”. The code above is still valid; give it to them
            directly.
          </Alert>
        </div>
      )}

      <p className="text-sm text-ink-muted">
        They enter it on the sign-in screen under{' '}
        <span className="text-ink">I have a setup code</span>, along with their
        email address and a password of their choosing. It expires in{' '}
        {result.expiresInMinutes >= 60
          ? `${result.expiresInMinutes / 60} hours`
          : `${result.expiresInMinutes} minutes`}
        .
      </p>

      <div className="mt-5">
        <Button onClick={onClose}>I have passed it on</Button>
      </div>
    </Card>
  );
}
