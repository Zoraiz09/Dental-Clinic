/** @type {import('tailwindcss').Config} */
// Noor Dentofacial Clinic — design tokens lifted from the UI mockups
// (forest green + cream + warm taupe; pastel gradient on auth).
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary — creamy caramel / toffee (token kept as `forest` so all
        // existing classNames re-skin automatically).
        forest: {
          50:  '#FAF3E9',
          100: '#F1E3CC',
          200: '#E4C9A1',
          300: '#D2A86E',
          400: '#BD8743',
          500: '#9C6A30', // accents / links / icons
          600: '#80531F', // primary CTA / headings
          700: '#674319',
          800: '#4E3213',
          900: '#35210C',
        },
        // Warm mocha — secondary ("Start Session") button
        taupe: {
          100: '#EDE4D7',
          300: '#C7B095',
          500: '#8A6B49',
          700: '#5E472E',
        },
        // Neutrals / surfaces — latte & cream
        cream:    '#F6EEE3',
        sand:     '#EADDC9',
        surface:  '#FFFDF8',
        ink:      '#36281C',
        muted:    '#6E5C4A',
        line:     '#E6D7C3',
        // Status (warm-tuned)
        danger:  '#BB4A2C',
        warning: '#B97E18',
        success: '#6E8A4F',
        info:    '#5E78A8',
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      fontFamily: {
        // Loaded in App via expo-font; falls back to system until then.
        heading: ['PlayfairDisplay_700Bold', 'serif'],
        sans: ['Inter_400Regular', 'System'],
        medium: ['Inter_500Medium', 'System'],
        semibold: ['Inter_600SemiBold', 'System'],
        bold: ['Inter_700Bold', 'System'],
      },
    },
  },
  plugins: [],
};
