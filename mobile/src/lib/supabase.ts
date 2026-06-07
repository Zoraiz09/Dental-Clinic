import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, USE_MOCK } from '../config/env';
import { SecureStoreAdapter } from './secureStoreAdapter';

/**
 * Single shared Supabase client. In MOCK mode (no credentials) we still
 * create a harmless client pointed at placeholders — the data layer
 * (src/api) routes around it and serves mock data instead, so nothing
 * actually hits the network.
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'public-anon-placeholder',
  {
    auth: {
      storage: SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export const isMock = USE_MOCK;

/**
 * A throwaway client with NO session persistence. Used when an admin
 * creates a staff account via signUp — running it on a separate client
 * keeps the admin's own session intact (signUp would otherwise swap it).
 */
export function createAuthOnlyClient(): SupabaseClient {
  return createClient(
    SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_ANON_KEY || 'public-anon-placeholder',
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
