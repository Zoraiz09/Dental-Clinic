import { Profile } from '../types/models';
import { repo } from './repo';

/**
 * Auth facade. Delegates to the repository (src/api/repo) — the mock
 * in-memory session vs live Supabase auth split lives behind that
 * interface. Exported names and signatures are unchanged.
 */

export const signInWithPassword = (identifier: string, password: string): Promise<Profile> =>
  repo.auth.signIn(identifier, password);

export const signOut = (): Promise<void> => repo.auth.signOut();

export const getCurrentProfile = (): Promise<Profile | null> => repo.auth.currentProfile();

export const sendPasswordReset = (email: string): Promise<void> => repo.auth.sendPasswordReset(email);

/**
 * Change the signed-in user's password. The current password is verified
 * first: in mock by comparing the stored value, in live by re-authenticating
 * (Supabase's updateUser does not check the old password on its own).
 */
export const changePassword = (currentPassword: string, newPassword: string): Promise<void> =>
  repo.auth.changePassword(currentPassword, newPassword);

/** Current signed-in user's id (mock or live), or null. Used to stamp
 *  created_by on records like expenses. */
export const getCurrentUserId = (): Promise<string | null> => repo.auth.currentUserId();
