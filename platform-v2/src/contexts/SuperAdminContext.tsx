import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { SuperAdminService } from '@/services/superAdminService';

// Platform-wide (not per-tournament) — wraps the whole authenticated admin area (see
// App.tsx) and runs SuperAdminService.attemptClaim() once per signed-in user, which is
// what turns a superAdminInvites/{email} doc or the hardcoded bootstrap allowlist into a
// real superAdmins/{uid} doc. Every per-tournament role check already ORs against
// isSuperAdmin() in firestore.rules, so once this resolves true the user transparently has
// admin access to every tournament without a permissions/{uid} doc in each one.
interface SuperAdminContextValue {
  isSuperAdmin: boolean;
  loading: boolean;
}

const SuperAdminContext = createContext<SuperAdminContextValue>({ isSuperAdmin: false, loading: true });

export function SuperAdminProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<SuperAdminContextValue>({ isSuperAdmin: false, loading: true });

  useEffect(() => {
    if (!user) {
      setState({ isSuperAdmin: false, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    SuperAdminService.attemptClaim(user)
      .then((isSuperAdmin) => { if (!cancelled) setState({ isSuperAdmin, loading: false }); })
      .catch(() => { if (!cancelled) setState({ isSuperAdmin: false, loading: false }); });
    return () => { cancelled = true; };
  }, [user]);

  return <SuperAdminContext.Provider value={state}>{children}</SuperAdminContext.Provider>;
}

export function useSuperAdmin(): SuperAdminContextValue {
  return useContext(SuperAdminContext);
}
