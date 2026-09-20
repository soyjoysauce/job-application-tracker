// Keeps signed-out visitors away from signed-in pages.
// This is convenience only — real protection is the server's requireAuth + RLS.
import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  // Still restoring the saved session: render nothing so the sign-in page doesn't flash.
  if (loading) return null;

  if (!session) {
    // `state.from` lets the sign-in page send the user back where they were going.
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
