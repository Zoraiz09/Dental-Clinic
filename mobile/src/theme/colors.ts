// Mirror of tailwind tokens for use in non-className contexts
// (navigation theme, status bar, SVG fills, gradients, shadows).
// Single source of truth is src/theme/palette.js — this file re-exports the
// same shape so every existing import stays byte-identical.
const p = require('./palette');

export const colors = {
  forest: p.forest as {
    50: string; 100: string; 200: string; 300: string; 400: string;
    500: string; 600: string; 700: string; 800: string; 900: string;
  },
  taupe: p.taupe as { 100: string; 300: string; 500: string; 700: string },
  cream:   p.cream   as string,
  sand:    p.sand    as string,
  surface: p.surface as string,
  ink:     p.ink     as string,
  muted:   p.muted   as string,
  line:    p.line    as string,
  white:   '#FFFFFF',
  danger:  p.danger  as string,
  warning: p.warning as string,
  success: p.success as string,
  info:    p.info    as string,
};

// Honest alias — matches tailwind.config.js `primary` alias.
export const primary = colors.forest;

// Gradient behind the Sign-In screen (calm off-white → soft teal).
export const authGradient = ['#F8FAF9', '#ECF6F3', '#D8EEE8'] as const;

// Shadow tint (used in screens that still need an inline shadowColor).
export const shadowTint = '#0F172A';

// Deep teal gradient for hero / summary cards (the ONE permitted gradient).
export const caramelGradient = ['#134E4A', '#0F766E', '#0D9488'] as const;

// Near-flat off-white backdrop behind the whole app.
export const appBackdrop = ['#F8FAF9', '#F5F8F7', '#EFF4F2'] as const;

// Surface tokens (glass is now solid-white; kept for structural compatibility).
export const glass = {
  fill:      '#FFFFFF',
  fillStrong:'#FFFFFF',
  border:    p.line as string, // #E2E8E6 hairline
  blur:      0,               // BlurView no longer used; kept for prop compat
};
