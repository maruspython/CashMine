import { Claim } from '@/api/types';
import { readItem, writeItem } from '@/storage';

/**
 * A claim the user confirmed on this device. It is saved before the first
 * POST, so a reload in the middle of a request can still resolve it.
 */
export type LocalClaim = {
  /** Idempotency-Key, also the id of the status screen. */
  key: string;
  /** The exact JSON body; every retry sends it unchanged. */
  body: string;
  asset: string;
  amount: string;
  destinationLabel: string;
  confirmedAt: number;
  /** Latest server state. Null while we do not know whether the claim exists. */
  claim: Claim | null;
  /** Why the server refused the request. Nothing was created. */
  rejected: string | null;
};

/** We do not know yet whether the server created this claim. */
export function isUnresolved(record: LocalClaim): boolean {
  return record.claim === null && record.rejected === null;
}

const KEEP_SETTLED = 30;

/** Each token has its own data, so its local claims are stored separately. */
export function localClaimsKey(token: string): string {
  // FNV-1a, so the storage key does not contain the token itself.
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `cashmine.claims.${(hash >>> 0).toString(16)}`;
}

export function loadLocalClaims(storageKey: string): LocalClaim[] {
  try {
    const parsed = JSON.parse(readItem(storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Newest first. Old settled records are dropped; unresolved and pending ones never are. */
export function saveLocalClaims(storageKey: string, records: LocalClaim[]): void {
  const kept = records.filter(
    (record, index) => index < KEEP_SETTLED || isUnresolved(record) || record.claim?.status === 'pending',
  );
  writeItem(storageKey, JSON.stringify(kept));
}
