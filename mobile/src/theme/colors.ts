// Mirror of tailwind tokens for use in non-className contexts
// (navigation theme, status bar, SVG fills, gradients, shadows).
// Creamy-caramel palette.
export const colors = {
  forest: {
    50: '#FAF3E9', 100: '#F1E3CC', 200: '#E4C9A1', 300: '#D2A86E',
    400: '#BD8743', 500: '#9C6A30', 600: '#80531F', 700: '#674319',
    800: '#4E3213', 900: '#35210C',
  },
  taupe: { 100: '#EDE4D7', 300: '#C7B095', 500: '#8A6B49', 700: '#5E472E' },
  cream: '#F6EEE3',
  sand: '#EADDC9',
  surface: '#FFFDF8',
  ink: '#36281C',
  muted: '#6E5C4A',
  line: '#E6D7C3',
  white: '#FFFFFF',
  danger: '#BB4A2C',
  warning: '#B97E18',
  success: '#6E8A4F',
  info: '#5E78A8',
};

// Soft caramel-cream gradient behind the Sign In screen.
export const authGradient = ['#F7E9CF', '#F1E2D2', '#E7D2B0'] as const;

// Warm shadow tint used across cards & floating buttons.
export const shadowTint = '#5E472E';

// Rich caramel gradient for hero / summary cards.
export const caramelGradient = ['#6F4622', '#9C6A30', '#BD8743'] as const;

// Soft warm backdrop behind the whole app (so frosted glass reads).
export const appBackdrop = ['#FBF2E4', '#F3E6D2', '#ECD8BC'] as const;

// Glassmorphism tokens.
export const glass = {
  fill: 'rgba(255,253,248,0.55)',      // translucent ivory overlay
  fillStrong: 'rgba(255,253,248,0.72)',
  border: 'rgba(255,255,255,0.65)',    // light reflective edge
  blur: 24,
};

