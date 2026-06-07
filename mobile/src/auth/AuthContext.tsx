import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Profile } from '../types/models';
import { getCurrentProfile, signInWithPassword, signOut } from '../api/auth';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Attempt auto-login from a persisted session on launch.
  useEffect(() => {
    (async () => {
      try {
        const p = await getCurrentProfile();
        setProfile(p);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      profile,
      loading,
      async signIn(identifier, password) {
        const p = await signInWithPassword(identifier, password);
        setProfile(p);
      },
      async logout() {
        await signOut();
        setProfile(null);
      },
    }),
    [profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
