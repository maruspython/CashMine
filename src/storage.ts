/**
 * Browser storage. localStorage can be missing or throw (private mode, blocked
 * site data); then values live only in memory for this visit.
 */

export function readItem(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string | null): void {
  try {
    if (value === null) {
      globalThis.localStorage?.removeItem(key);
    } else {
      globalThis.localStorage?.setItem(key, value);
    }
  } catch {
    // Not persisted; the in-memory state still works.
  }
}
