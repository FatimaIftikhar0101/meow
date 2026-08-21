import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Empty, Field, PageHeader, Pill } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL, type StaffRole } from '../lib/permissions';

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

  function onChangeRole(member: StaffMember, role: StaffRole) {
    const reason = window.prompt(
      `Why is ${member.email} becoming ${ROLE_LABEL[role]}?`,
    );
    if (!reason) return;
    setError(null);
    assignRole.mutate({ id: member.id, role, reason });
  }

  function onToggleActive(member: StaffMember) {
    const verb = member.suspended ? 'reactivating' : 'deactivating';
    const reason = window.prompt(`Why are you ${verb} ${member.email}?`);
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
                          className="rounded-lg border border-line-strong bg-card px-2 py-1 text-sm text-ink"
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
                      {can('staff.write') && !isSelf && (
                        <button
                          onClick={() => onToggleActive(m)}
                          className="text-xs text-ink-muted underline hover:text-ink"
                        >
                          {m.suspended ? 'Reactivate' : 'Deactivate'}
                        </button>
                      )}
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
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  const invite = useMutation({
    mutationFn: async () =>
      (
        await api.post<InviteResult>('/staff/invite', {
          email: email.trim(),
          role,
          reason,
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
            required
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm text-ink"
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
          minLength={3}
          required
        />
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
}: {
  result: InviteResult;
  onClose: () => void;
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
        Account created for {result.email}
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        Give them this code. It is shown once and cannot be looked up again.
      </p>

      <div className="my-5 flex items-center gap-4">
        <span className="font-mono text-3xl tracking-[0.3em] text-ink">
          {result.setupCode}
        </span>
        <Button variant="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

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
