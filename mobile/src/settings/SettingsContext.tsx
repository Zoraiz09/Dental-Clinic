import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

interface Prefs {
  language: 'en' | 'ur';
  biometricEnabled: boolean;
  pushEnabled: boolean;
}
const DEFAULTS: Prefs = { language: 'en', biometricEnabled: false, pushEnabled: false };
const KEY = 'ndc-prefs';

interface SettingsState extends Prefs {
  ready: boolean;
  setLanguage: (l: 'en' | 'ur') => Promise<void>;
  setBiometric: (v: boolean) => Promise<void>;
  setPush: (v: boolean) => Promise<void>;
}

const Ctx = createContext<SettingsState | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const loaded: Prefs = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
        setPrefs(loaded);
        i18n.changeLanguage(loaded.language);
        I18nManager.allowRTL(loaded.language === 'ur');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = async (next: Prefs) => {
    setPrefs(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  };

  const value = useMemo<SettingsState>(
    () => ({
      ...prefs,
      ready,
      async setLanguage(language) {
        await persist({ ...prefs, language });
        i18n.changeLanguage(language);
        const rtl = language === 'ur';
        // Apply RTL direction. A full mirror needs an app reload (handled in UI copy).
        I18nManager.allowRTL(rtl);
        I18nManager.forceRTL(rtl);
      },
      setBiometric: (biometricEnabled) => persist({ ...prefs, biometricEnabled }),
      setPush: (pushEnabled) => persist({ ...prefs, pushEnabled }),
    }),
    [prefs, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
