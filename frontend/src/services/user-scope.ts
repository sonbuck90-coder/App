/**
 * UserScope — namespaces every per-user AsyncStorage key by the currently
 * active user profile id.
 *
 * When the user switches accounts in the in-app User Switcher we simply
 * update `active_profile_id` and bump our in-memory cache; every storage
 * read/write that goes through `userScopedKey()` then targets a fresh
 * key space belonging to the new user.
 *
 * Keys that *should* be scoped per-user:
 *   - hsbc_offline_db_v1          (accounts, balances, txns, payees, …)
 *   - hsbc_customization          (theme + bank theme + logo + header colour)
 *
 * Keys that stay GLOBAL (shared across all users on the device):
 *   - saved_profiles               (the list of profiles itself)
 *   - active_profile_id            (which profile is logged in)
 *   - auth tokens / passcode hashes
 *
 * Whenever we first scope a key for a user that does not yet have a value
 * we automatically migrate from the legacy non-scoped key so existing
 * customers don't see their data wiped on upgrade.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACTIVE_PROFILE_KEY = 'active_profile_id';
export const PROFILES_KEY = 'saved_profiles';
export const DEFAULT_USER_ID = 'oliver-default';

let cachedActiveId: string | null = null;
let pending: Promise<string> | null = null;

/** Read (and memoise) the currently active user profile id. */
export async function getActiveUserId(): Promise<string> {
  if (cachedActiveId) return cachedActiveId;
  if (pending) return pending;
  pending = (async () => {
    try {
      const id = await AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
      cachedActiveId = id || DEFAULT_USER_ID;
    } catch {
      cachedActiveId = DEFAULT_USER_ID;
    }
    pending = null;
    return cachedActiveId!;
  })();
  return pending;
}

/** Set the active user id (in storage + in-memory cache). */
export async function setActiveUserId(id: string): Promise<void> {
  cachedActiveId = id;
  await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, id);
}

/**
 * Build a per-user storage key by suffixing the base key with the active
 * user id. The default user keeps the legacy (un-suffixed) key so existing
 * installs don't lose their data.
 */
export async function userScopedKey(baseKey: string): Promise<string> {
  const id = await getActiveUserId();
  if (id === DEFAULT_USER_ID) return baseKey; // legacy path
  return `${baseKey}::${id}`;
}

/**
 * One-shot migration helper.
 *
 * The default user (`oliver-default`) keeps using the legacy non-suffixed
 * key, so no migration is ever required. Any *other* user must always
 * start with a fresh seed — copying the legacy data into their key would
 * make them inherit Oliver's transactions, which violates user isolation.
 *
 * We therefore keep this function as a no-op stub so existing call sites
 * remain valid. The flag protects against bringing the broken behaviour
 * back in a future refactor.
 */
export async function migrateLegacyIfNeeded(_baseKey: string): Promise<void> {
  // Intentionally a no-op. See doc above.
}

// -----------------------------------------------------------------------------
// Subscriber registry — lets contexts (CustomizationContext, offline-store)
// listen for "active user changed" events and reload their state.
// -----------------------------------------------------------------------------
type Listener = (newUserId: string) => void | Promise<void>;
const listeners = new Set<Listener>();

export function onActiveUserChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Switch the active user id and notify every listener. */
export async function switchActiveUser(newId: string): Promise<void> {
  await setActiveUserId(newId);
  // Snapshot the listener set so dynamic add/remove during dispatch is safe.
  const ls = Array.from(listeners);
  for (const l of ls) {
    try {
      await l(newId);
    } catch (e) {
      console.warn('user-scope listener error', e);
    }
  }
}
