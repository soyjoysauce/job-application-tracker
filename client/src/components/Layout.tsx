// Shell around every signed-in page: header, navigation, sign-out.
import { NavLink, Outlet, useNavigate } from 'react-router';

import { useAuth } from '../hooks/useAuth';
import { Button } from './ui';

// NavLink tells us whether its route is the active one, so it can be highlighted.
function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-900';
}

export function Layout() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    void navigate('/signin', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold">Job Application Tracker</span>
          <nav className="flex gap-4 text-sm">
            <NavLink to="/profile" className={navLinkClass}>
              Profile
            </NavLink>
            <NavLink to="/account" className={navLinkClass}>
              Account
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-500">{session?.user.email}</span>
            <Button variant="secondary" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Outlet = wherever React Router renders the current page. */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
