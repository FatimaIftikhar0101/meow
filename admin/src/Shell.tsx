import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { ROLE_LABEL } from './lib/permissions';
import { visibleNav } from './nav';

/**
 * The frame every signed-in screen sits in.
 *
 * The sidebar is built from the permission list the server sent, so a support
 * agent does not see Staff & roles at all. That is courtesy, not security —
 * `PermissionsGuard` is what refuses the request — but a link that leads to a
 * 403 wastes a colleague's time and teaches them to distrust the navigation.
 */
export default function Shell() {
  const { profile, can, signOut } = useAuth();
  const items = visibleNav(can);

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-inset">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-8 items-center justify-center rounded-full bg-roundel">
            <span className="font-display text-sm text-gold">M</span>
          </span>
          <span className="font-display text-base text-ink">Back office</span>
        </div>

        <nav className="flex-1 px-3">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `mb-0.5 block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-on-accent'
                    : 'text-ink-muted hover:bg-accent-soft hover:text-ink'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="truncate text-sm text-ink">{profile?.email}</p>
          <p className="text-xs text-ink-muted">
            {profile ? ROLE_LABEL[profile.role] : ''}
          </p>
          <button
            onClick={() => signOut()}
            className="mt-2 text-xs text-ink-muted underline hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-canvas px-8 py-7">
        <Outlet />
      </main>
    </div>
  );
}
