import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Shell from './Shell';
import { AuthProvider, useAuth } from './lib/auth';
import type { Permission } from './lib/permissions';
import Audit from './routes/Audit';
import Customers from './routes/Customers';
import MfaEnrolment from './routes/MfaEnrolment';
import SignIn from './routes/SignIn';
import Staff from './routes/Staff';
import Transfers from './routes/Transfers';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A stale figure on a money screen is worse than a refetch, and this is
      // a desktop app on an office connection rather than a phone on data.
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

/**
 * Three states, in order of precedence.
 *
 * Not signed in, signed in but not yet enrolled in two-factor, and signed in
 * properly. The middle one is not a redirect from the router's point of view —
 * it replaces the whole route table, so there is no URL an un-enrolled staff
 * member can type to get past it.
 */
function Gate() {
  const { status, needsEnrolment, can } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-inset text-sm text-ink-muted">
        Loading…
      </div>
    );
  }

  if (status === 'signedOut' || status === 'mfaRequired') return <SignIn />;
  if (needsEnrolment) return <MfaEnrolment />;

  // Only the routes this person can actually reach are registered, so a typed
  // URL for a page they lack the permission for lands on the fallback rather
  // than rendering and then failing its first request.
  const routes: Array<{
    path: string;
    element: ReactElement;
    permission: Permission;
  }> = [
    { path: '/transfers', element: <Transfers />, permission: 'transfer.read' },
    { path: '/customers', element: <Customers />, permission: 'customer.read' },
    { path: '/audit', element: <Audit />, permission: 'audit.read' },
    { path: '/staff', element: <Staff />, permission: 'staff.read' },
  ];
  const allowed = routes.filter((r) => can(r.permission));
  const home = allowed[0]?.path ?? '/transfers';

  return (
    <Routes>
      <Route element={<Shell />}>
        {allowed.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  );
}
