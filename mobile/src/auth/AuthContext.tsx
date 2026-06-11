import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Profile } from '../types/models';
import { getCurrentProfile, signInWithPassword, signOut } from '../api/auth';
import { ProfileUpdate, updateMyProfile } from '../api/mutations';
import { registerForPush, unregisterPush } from '../lib/push';
import { useSettings } from '../settings/SettingsContext';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { pushEnabled, ready: settingsReady } = useSettings();

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

  // Keep this device's push registration in step with the signed-in user
  // (and the Settings toggle). Fire-and-forget: no-ops in mock/Expo Go/denied.
  useEffect(() => {
    if (settingsReady && pushEnabled && profile?.id) registerForPush(profile.id);
  }, [settingsReady, pushEnabled, profile?.id]);

  const value = useMemo<AuthState>(
    () => ({
      profile,
      loading,
      async signIn(identifier, password) {
        const p = await signInWithPassword(identifier, password);
        setProfile(p);
      },
      async logout() {
        // Revoke this device's push token while the session (and its RLS
        // delete permission) still exists, so the next user of this phone
        // doesn't receive the previous user's alerts.
        await unregisterPush();
        await signOut();
        setProfile(null);
      },
      async updateProfile(patch) {
        if (!profile) throw new Error('You are not signed in.');
        const updated = await updateMyProfile(profile.id, patch);
        setProfile(updated);
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
