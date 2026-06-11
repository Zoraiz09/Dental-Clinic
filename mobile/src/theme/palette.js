// Single source of truth for all design tokens.
// Consumed by tailwind.config.js (require) and src/theme/colors.ts (import).
// Token names are legacy (forest/taupe) but values are now the teal/gold premium palette.
module.exports = {
  forest: {
    50:  '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF', // focus ring
    500: '#0D9488', // links / icons
    600: '#0F766E', // primary CTA  — white on this = 5.5:1 AA
    700: '#115E59', // pill text on forest-100
    800: '#134E4A',
    900: '#042F2E',
  },
  // Brand-gold accent ramp (logo is gold tooth on cream — unchanged)
  taupe: {
    100: '#F6EEDD',
    300: '#D9BC8C',
    500: '#8E5F23', // gold secondary button — white ≈ 5:1
    700: '#6B4718',
  },
  // Neutrals / surfaces
  cream:   '#F8FAF9', // app background
  sand:    '#EEF2F0', // neutral chip bg
  surface: '#FFFFFF', // card surface
  ink:     '#0F172A', // primary text  — on white 15.9:1
  muted:   '#64748B', // secondary text — on white 4.8:1 AA
  line:    '#E2E8E6', // hairline borders
  // Status (semantic, WCAG-safe at 11px semibold)
  danger:  '#DC2626',
  warning: '#B45309', // amber-700 chosen so 11px pill text passes
  success: '#15803D',
  info:    '#2563EB',
};
