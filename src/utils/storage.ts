/**
 * safeStorage provides a bulletproof fallback for standard localStorage operations
 * when running inside sandboxed iframes or environments where third-party storage is restricted.
 */

const memoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[Storage Alert] Safe read fallback active for key "${key}":`, e);
    }
    return memoryStorage.get(key) || null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`[Storage Alert] Safe write fallback active for key "${key}":`, e);
    }
    memoryStorage.set(key, value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`[Storage Alert] Safe delete fallback active for key "${key}":`, e);
    }
    memoryStorage.delete(key);
  }
};
