import { Platform, useWindowDimensions } from 'react-native';

/**
 * One breakpoint decides when the app wears its website face: a browser
 * window at least this wide gets the sidebar/desktop layout; everything
 * narrower (and every native phone) keeps the mobile UI. Matches
 * Tailwind's `lg:` so NativeWind classes and JS checks agree.
 */
export const DESKTOP_BREAKPOINT = 1024;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}
