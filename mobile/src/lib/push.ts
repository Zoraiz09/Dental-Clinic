import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase, isMock } from './supabase';

/**
 * Register the device for push notifications and store the token in
 * `device_tokens` (description.md §8). No-ops gracefully in mock mode or
 * on simulators without push support.
 */
export async function registerForPush(profileId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
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
