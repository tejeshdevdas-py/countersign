import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute() {
  const { canEnterApp, isInitializing, dataOwnerId } = useAuth();

  if (isInitializing) return null;
  // canEnterApp is false for a real signed-out session and while a real owner
  // change is in flight. Same-owner token refresh keeps it true.
  // Countersign never signs in, so it never redirects to the login page.
  if (!LOCAL_ONLY && !canEnterApp) return <Navigate to="/login" replace />;

  // Owner changes must remount the protected tree so transient New Maker
  // drafts and other route-local state cannot leak across data namespaces.
  return <Outlet key={dataOwnerId ?? 'signed-out'} />;
}
