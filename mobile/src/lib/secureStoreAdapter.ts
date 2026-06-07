import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage backed by expo-secure-store (encrypted),
 * per description.md §8 — the JWT must NOT sit in plain AsyncStorage.
 *
 * SecureStore caps each value at ~2KB, but a Supabase session (access +
 * refresh token) can exceed that, so we transparently chunk large values.
 *
 * On web (browser preview) SecureStore isn't available, so we fall back
 * to localStorage.
 */
const CHUNK_SIZE = 1800;
const META_SUFFIX = '__chunks';

const WebStoreAdapter = {
  async getItem(key: string) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  },
  async setItem(key: string, value: string) {
    try { globalThis.localStorage?.setItem(key, value); } catch {}
  },
  async removeItem(key: string) {
    try { globalThis.localStorage?.removeItem(key); } catch {}
  },
};

const NativeSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const meta = await SecureStore.getItemAsync(key + META_SUFFIX);
    if (meta) {
      const count = parseInt(meta, 10);
      let out = '';
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(`${key}__${i}`);
        if (part == null) return null;
        out += part;
      }
      return out;
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(key + META_SUFFIX).catch(() => {});
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(
        `${key}__${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    await SecureStore.setItemAsync(key + META_SUFFIX, String(chunks));
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },

  async removeItem(key: string): Promise<void> {
    const meta = await SecureStore.getItemAsync(key + META_SUFFIX);
    if (meta) {
      const count = parseInt(meta, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}__${i}`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(key + META_SUFFIX).catch(() => {});
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

export const SecureStoreAdapter =
  Platform.OS === 'web' ? WebStoreAdapter : NativeSecureStoreAdapter;
