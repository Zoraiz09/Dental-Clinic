import { supabase, isMock } from '../lib/supabase';
import { Profile } from '../types/models';
import { mockProfiles } from './mockData';

const MOCK_KEY = 'mock-session-user-id';
// Tiny in-memory mock session (persisted via SecureStore is overkill for demo).
let mockCurrentUserId: string | null = null;

export async function signInWithPassword(
  identifier: string,
  password: string,
): Promise<Profile> {
  if (isMock) {
    // Match by email OR phone; password is accepted as "password" for any demo user.
    const found = mockProfiles.find(
      (p) => p.email === identifier.trim().toLowerCase() || p.phone === identifier.trim(),
    );
    if (!found || (password && password !== found.password && password !== 'password')) {
      throw new Error('Invalid credentials. Try admin@noor.clinic / password');
    }
    if (!found.is_active) throw new Error('This account has been deactivated. Contact your admin.');
    mockCurrentUserId = found.id;
    const { password: _pw, ...profile } = found;
    return profile;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: identifier.includes('@') ? identifier : `${identifier}`,
    password,
  });
  if (error) throw error;
  const profile = await fetchProfile(data.user.id);
  if (!profile.is_active) {
    await supabase.auth.signOut();
    throw new Error('This account has been deactivated. Contact your admin.');
  }
  return profile;
}

export async function signOut(): Promise<void> {
  if (isMock) {
    mockCurrentUserId = null;
    return;
  }
  await supabase.auth.signOut();
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (isMock) {
    if (!mockCurrentUserId) return null;
    const found = mockProfiles.find((p) => p.id === mockCurrentUserId);
    if (!found) return null;
    const { password: _pw, ...profile } = found;
    return profile;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  try {
    const profile = await fetchProfile(data.session.user.id);
    if (!profile.is_active) { await supabase.auth.signOut(); return null; }
    return profile;
  } catch {
    return null;
  }
}

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (isMock) return; // no-op in demo
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/**
 * Change the signed-in user's password. The current password is verified
 * first: in mock by comparing the stored value, in live by re-authenticating
 * (Supabase's updateUser does not check the old password on its own).
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (isMock) {
    const user = mockProfiles.find((p) => p.id === mockCurrentUserId);
    if (!user) throw new Error('You are not signed in.');
    if (currentPassword !== (user.password ?? 'password')) {
      throw new Error('Current password is incorrect.');
    }
    user.password = newPassword;
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) throw new Error('You are not signed in.');
  // Verify the current password by re-authenticating.
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (signInErr) throw new Error('Current password is incorrect.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export { MOCK_KEY };
