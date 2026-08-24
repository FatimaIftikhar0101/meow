import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Shell from './Shell';
import { ReasonDialogProvider } from './components/ReasonDialog';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import type { Permission } from './lib/permissions';
import Approvals from './routes/Approvals';
import Overview from './routes/Overview';
import Audit from './routes/Audit';
import Kyc from './routes/Kyc';
import Ledger from './routes/Ledger';
import CustomerDetail from './routes/CustomerDetail';
import Compliance from './routes/Compliance';
import Customers from './routes/Customers';
import MfaEnrolment from './routes/MfaEnrolment';
import SignIn from './routes/SignIn';
import Staff from './routes/Staff';
import TransferDetail from './routes/TransferDetail';
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
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AuthProvider>
            {/* Inside AuthProvider so the dialog is available to every signed-in
                screen, and outside the router so a reason survives a navigation
                that happens while it is open. */}
            <ReasonDialogProvider>
              <Gate />
            </ReasonDialogProvider>
          </AuthProvider>
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
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
    /** Omitted for the pages every staff member can reach. */
    permission?: Permission;
  }> = [
    // First, and so the default landing page: whatever else a person's role
    // opens, the question they arrive with is what needs them today.
    { path: '/overview', element: <Overview /> },
    { path: '/transfers', element: <Transfers />, permission: 'transfer.read' },
    // Same permission as the list it is reached from. Registered separately
    // rather than nested, because the detail page is a full screen and not a
    // panel inside the queue.
    {
      path: '/transfers/:id',
      element: <TransferDetail />,
      permission: 'transfer.read',
    },
    { path: '/customers', element: <Customers />, permission: 'customer.read' },
    {
      path: '/customers/:id',
      element: <CustomerDetail />,
      permission: 'customer.read',
    },
    { path: '/kyc', element: <Kyc />, permission: 'kyc.read' },
    { path: '/ledger', element: <Ledger />, permission: 'ledger.read' },
    {
      path: '/compliance',
      element: <Compliance />,
      permission: 'alert.read',
    },
    {
      path: '/approvals',
      element: <Approvals />,
      permission: 'approval.request',
    },
    { path: '/audit', element: <Audit />, permission: 'audit.read' },
    { path: '/staff', element: <Staff />, permission: 'staff.read' },
  ];
  const allowed = routes.filter((r) => !r.permission || can(r.permission));
  // The fallback has to be a path that can actually be navigated to. `allowed`
  // now contains a parameterised route, and redirecting to "/transfers/:id"
  // literally is a 404 that looks like a bug in the router.
  const home = allowed.find((r) => !r.path.includes(':'))?.path ?? '/transfers';

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
