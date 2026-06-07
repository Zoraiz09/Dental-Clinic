import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirm. On native it uses Alert; on web (where RN's
 * Alert is a no-op) it uses the browser's window.confirm. Resolves true
 * if the user confirmed.
 */
export function confirmAsync(
  title: string,
  message?: string,
  confirmLabel = 'Confirm',
  destructive = false,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(text) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

/** Cross-platform notice (single OK). */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
