import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase, isMock } from './supabase';

/**
 * OS push registration + behaviour. The server side is migration 0014:
 * every in_app_notifications row is pushed to the recipient's registered
 * devices via Expo, so alerts arrive even when the app is closed.
 */

// While the app is OPEN the in-app bell (Realtime, useNotifications) is the
// alert surface — incoming pushes stay out of the way in the foreground and
// only land in the system tray. Background/closed delivery is the OS's job
// and is unaffected by this handler. (Web has no Expo push at all — the
// bell alone covers the browser, so all of this is native-only.)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// The token registered in this session, so logout can revoke exactly it.
let currentToken: string | null = null;

/**
 * Register the device for push notifications and store the token in
 * `device_tokens` (description.md §8). No-ops gracefully in mock mode, on
 * simulators, in Expo Go (no remote push since SDK 53), or when permission
 * is denied.
 */
export async function registerForPush(profileId: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      // HIGH importance = heads-up banner + sound when the app is closed.
      // The id must stay 'default' — migration 0014 sends channelId: 'default'.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Clinic alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Dev/production builds need the EAS project id to mint an Expo token.
    const projectId: string | undefined =
      (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    currentToken = token;
    if (!isMock && token) {
      await supabase
        .from('device_tokens')
        .upsert({ profile_id: profileId, token, platform: Platform.OS }, { onConflict: 'profile_id,token' });
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Stop pushes to this device: remove the session's token row. Called on
 * logout (before the session is gone — RLS only lets users delete their own
 * rows) and when the user switches the Settings toggle off.
 */
export async function unregisterPush(): Promise<void> {
  try {
    if (isMock || !currentToken) return;
    await supabase.from('device_tokens').delete().eq('token', currentToken);
    currentToken = null;
  } catch {
    // Best-effort: an orphaned token just means a stray push to this device.
  }
}
