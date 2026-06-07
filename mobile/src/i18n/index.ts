import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './en.json';
import ur from './ur.json';

const deviceLang = getLocales()[0]?.languageCode === 'ur' ? 'ur' : 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ur: { translation: ur } },
  lng: deviceLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
export const isRTL = (lng: string) => lng === 'ur';
