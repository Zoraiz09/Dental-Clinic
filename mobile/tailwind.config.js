/** @type {import('tailwindcss').Config} */
// Design tokens sourced from src/theme/palette.js — ONE source of truth.
// Token names are legacy (forest/taupe) but values are the teal/gold premium palette.
const palette = require('./src/theme/palette');

module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ...palette,
        // Honest alias — new code should prefer `primary-*` over `forest-*`.
        primary: palette.forest,
        brand:   palette.taupe,
      },
      borderRadius: {
        xl:   '14px',
        '2xl':'16px',
        '3xl':'24px',
      },
      fontFamily: {
        // Inter weights loaded in App.tsx via @expo-google-fonts/inter.
        heading:  ['Inter_700Bold',    'System'],
        sans:     ['Inter_400Regular', 'System'],
        medium:   ['Inter_500Medium',  'System'],
        semibold: ['Inter_600SemiBold','System'],
        bold:     ['Inter_700Bold',    'System'],
      },
    },
  },
  plugins: [],
};
