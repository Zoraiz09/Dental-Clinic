import Constants from 'expo-constants';

/**
 * Runtime configuration. Values come from `app.json` -> `expo.extra`,
 * which in turn read from the environment at build time. For local dev
 * you can also drop them straight into app.json.
 *
 * Until a real Supabase project is wired up, the app runs in MOCK mode
 * (USE_MOCK = true) against in-memory demo data — so it looks and works
 * end-to-end today. Set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY to go live.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? '';

/** When no Supabase credentials are present, fall back to mock data. */
export const USE_MOCK = !SUPABASE_URL || !SUPABASE_ANON_KEY;
