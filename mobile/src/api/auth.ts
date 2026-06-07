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

export { MOCK_KEY };
