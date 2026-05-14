/**
 * Local notification helper.
 *
 * Triggers a real native banner notification on iOS / Android using
 * `expo-notifications` whenever the offline adapter completes a transaction.
 *
 * On web we fall back to the W3C Notification API (browser banners) and stay
 * silent if the user hasn't granted permission.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let permissionRequested = false;
let permissionGranted = false;

// Configure how foreground notifications are presented on iOS so the banner
// actually pops up while the app is open (default would be silent).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // Older API names for backward compat with SDK <49
    shouldShowAlert: true,
  }) as any,
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (permissionGranted) return true;
  if (Platform.OS === 'web') {
    // Browser API
    try {
      // eslint-disable-next-line no-undef
      if (typeof Notification === 'undefined') return false;
      // eslint-disable-next-line no-undef
      if (Notification.permission === 'granted') {
        permissionGranted = true;
        return true;
      }
      if (permissionRequested) return false;
      permissionRequested = true;
      // eslint-disable-next-line no-undef
      const res = await Notification.requestPermission();
      permissionGranted = res === 'granted';
      return permissionGranted;
    } catch {
      return false;
    }
  }
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') {
      permissionGranted = true;
      return true;
    }
    if (permissionRequested) return false;
    permissionRequested = true;
    const req = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    permissionGranted = req.status === 'granted';
    return permissionGranted;
  } catch {
    return false;
  }
}

export interface TxnNotification {
  title: string;
  body: string;
  /** Optional data payload, e.g. transaction id, to navigate from the tap. */
  data?: Record<string, any>;
}

export async function sendTransactionNotification(n: TxnNotification): Promise<void> {
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  try {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-undef
      const note = new Notification(n.title, {
        body: n.body,
        icon: '/favicon.ico',
        tag: `hsbc-${Date.now()}`,
      });
      // auto-close after 6s
      setTimeout(() => {
        try { note.close(); } catch { /* ignore */ }
      }, 6000);
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: n.title,
        body: n.body,
        data: n.data || {},
        sound: 'default',
      },
      // null → fire immediately
      trigger: null,
    });
  } catch (e) {
    // Never let notification failures break the underlying flow
    console.warn('notification failed', e);
  }
}

/** Helper to format the GBP amount consistently in notifications. */
export function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}
