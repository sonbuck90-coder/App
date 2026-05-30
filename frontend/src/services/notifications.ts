/**
 * Local notification helper.
 *
 * Triggers a real native banner notification on iOS / Android using
 * `expo-notifications` whenever the offline adapter completes a transaction.
 *
 * Branding behaviour:
 *  - Reads the currently-selected UK bank theme from AsyncStorage
 *    (`hsbc_customization` key) so that notifications "match the theme".
 *  - Prefixes the notification title with the bank's name
 *    (e.g. "Barclays · Payment sent") so it visually belongs to that bank.
 *  - Attaches a small bank logo PNG as a thumbnail on iOS so the banner
 *    shows the correct bank icon next to the text. This works in Expo Go
 *    because the underlying asset is bundled and resolved through
 *    `expo-asset` to a local file URI that the system can read.
 *  - On web, uses the same logo file as the Notification icon.
 *
 * NOTE: Expo Go itself owns the launcher icon used by iOS for the small
 * "from-app" icon shown in the lock-screen banner. That cannot be replaced
 * without a custom dev build. A standalone build will use `expo.notification`
 * config from app.json (HSBC red + bundled HSBC icon).
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Static map of theme-id → require() handle. Each PNG lives under
// /assets/images/banks and is generated as a 192x192 monogram tile.
// require() must be statically analyzable, so we cannot index into a
// dynamic string — we explicitly list every theme.
const BANK_ICON_MODULES: Record<string, number> = {
  hsbc:        require('../../assets/images/banks/hsbc.png'),
  barclays:    require('../../assets/images/banks/barclays.png'),
  lloyds:      require('../../assets/images/banks/lloyds.png'),
  natwest:     require('../../assets/images/banks/natwest.png'),
  santander:   require('../../assets/images/banks/santander.png'),
  halifax:     require('../../assets/images/banks/halifax.png'),
  monzo:       require('../../assets/images/banks/monzo.png'),
  starling:    require('../../assets/images/banks/starling.png'),
  revolut:     require('../../assets/images/banks/revolut.png'),
  nationwide:  require('../../assets/images/banks/nationwide.png'),
  tsb:         require('../../assets/images/banks/tsb.png'),
  firstdirect: require('../../assets/images/banks/firstdirect.png'),
};

const BANK_NAMES: Record<string, string> = {
  hsbc: 'HSBC UK',
  barclays: 'Barclays',
  lloyds: 'Lloyds Bank',
  natwest: 'NatWest',
  santander: 'Santander',
  halifax: 'Halifax',
  monzo: 'Monzo',
  starling: 'Starling',
  revolut: 'Revolut',
  nationwide: 'Nationwide',
  tsb: 'TSB',
  firstdirect: 'first direct',
};

let permissionRequested = false;
let permissionGranted = false;

// Cache the resolved local URI per theme id so we don't redo the asset
// download/copy work on every notification.
const iconUriCache: Record<string, string> = {};

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

// Read the user's chosen bank theme id from the customization store.
async function getActiveBankThemeId(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem('hsbc_customization');
    if (!raw) return 'hsbc';
    const parsed = JSON.parse(raw);
    return parsed?.bankThemeId || 'hsbc';
  } catch {
    return 'hsbc';
  }
}

// Resolve the bundled PNG for a given theme to a local URI suitable for
// passing to `expo-notifications` attachments or a browser Notification.
async function getBankIconUri(themeId: string): Promise<string | null> {
  if (iconUriCache[themeId]) return iconUriCache[themeId];
  const mod = BANK_ICON_MODULES[themeId] || BANK_ICON_MODULES.hsbc;
  if (!mod) return null;
  try {
    const asset = Asset.fromModule(mod);
    // On native, downloadAsync ensures the file is materialised on disk
    // and `localUri` becomes a file:// URL the system can read.
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (uri) iconUriCache[themeId] = uri;
    return uri || null;
  } catch (e) {
    console.warn('Failed to resolve bank icon for', themeId, e);
    return null;
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
    const themeId = await getActiveBankThemeId();
    const bankName = BANK_NAMES[themeId] || 'HSBC UK';
    const iconUri = await getBankIconUri(themeId);

    // Prefix the title so users always see which bank the alert is from.
    // If the caller already starts with that bank name, don't double-prefix.
    const title = n.title.startsWith(bankName) ? n.title : `${bankName} · ${n.title}`;

    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-undef
      const note = new Notification(title, {
        body: n.body,
        icon: iconUri || '/favicon.ico',
        badge: iconUri || undefined,
        tag: `hsbc-${Date.now()}`,
      });
      // auto-close after 6s
      setTimeout(() => {
        try { note.close(); } catch { /* ignore */ }
      }, 6000);
      return;
    }

    // Build optional attachments for iOS so the chosen bank logo shows up
    // inside the notification body. Android shows the app's notification
    // icon configured in app.json; the attachment is silently ignored
    // there which is fine.
    const attachments = iconUri
      ? [
          {
            identifier: `bank-${themeId}`,
            url: iconUri,
            type: 'image/png',
            typeHint: 'public.png',
          } as any,
        ]
      : undefined;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        subtitle: Platform.OS === 'ios' ? bankName : undefined,
        body: n.body,
        data: { ...(n.data || {}), themeId, bankName },
        sound: 'default',
        ...(attachments ? { attachments } : {}),
      } as any,
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

/**
 * Pre-warm the icon cache for the active theme. Call once at app boot to
 * avoid a first-notification stutter as the asset downloads.
 */
export async function prewarmNotificationAssets(): Promise<void> {
  try {
    const themeId = await getActiveBankThemeId();
    await getBankIconUri(themeId);
  } catch {
    /* non-fatal */
  }
}
