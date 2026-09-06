import { NavLink, Outlet } from 'react-router-dom';
import { ThemeToggle } from './components/ThemeToggle';
import { UpdateNotice } from './components/UpdateNotice';
import { GroupLabel } from './components/ui';
import { useAuth } from './lib/auth';
import { ROLE_LABEL } from './lib/permissions';
import { visibleNavGroups } from './nav';

/**
 * The frame every signed-in screen sits in.
 *
 * The sidebar is built from the permission list the server sent, so a support
 * agent does not see Staff & roles at all. That is courtesy, not security —
 * `PermissionsGuard` is what refuses the request — but a link that leads to a
 * 403 wastes a colleague's time and teaches them to distrust the navigation.
 *
 * Two things about the sizing. The rail is wider than it was because the
 * entries are grouped now and a heading needs room to be a heading. And the
 * content column is capped: this runs on desk monitors, and a table allowed to
 * fill 2560px puts a sender's email and their amount so far apart that
 * checking one against the other becomes a head movement. The cap is generous
 * enough that nothing wraps and no column has to be dropped.
 */
export default function Shell() {
  const { profile, can, signOut } = useAuth();
  const groups = visibleNavGroups(can);

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-inset">
        <div className="flex items-center gap-2.5 px-5 py-5">
          {/* The product's own mark. No `bg-roundel` disc behind it any more:
              the artwork carries its own ring, and a second disc under it read
              as a badge stuck on a badge. */}
          <img src="/logo.png" alt="" width={32} height={32} className="size-8 shrink-0" />
          <span className="font-display text-base text-ink">Back office</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.label ?? 'top'}>
              {group.label && <GroupLabel>{group.label}</GroupLabel>}
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    /* The active entry is marked on its leading edge as well as
                       filled. On the dark scheme a fill alone sat very close to
                       the rail's own ground, and the edge reads at a glance in
                       both. */
                    `mb-0.5 flex items-center rounded-lg border-l-2 px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'border-gold bg-accent text-on-accent'
                        : 'border-transparent text-ink-muted hover:bg-accent-soft hover:text-ink'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <UpdateNotice />

        <div className="border-t border-line px-5 py-4">
          <div className="mb-3">
            <ThemeToggle />
          </div>
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

      <main className="flex-1 overflow-y-auto bg-canvas">
        <div className="mx-auto max-w-[1600px] px-8 py-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
