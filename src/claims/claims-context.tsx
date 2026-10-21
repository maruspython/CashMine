import { useQueries, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

import { ApiError, errorMessage } from '@/api/client';
import { getClaim, postClaim } from '@/api/endpoints';
import { ClaimRequest } from '@/api/types';
import { useToken } from '@/auth/token-context';

import { isUnresolved, LocalClaim, loadLocalClaims, localClaimsKey, saveLocalClaims } from './local-claims';
import { afterFailedPost } from './post-outcome';

/** Waits between automatic retries of a POST whose outcome is unknown. */
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
/** A pending claim settles in about 20 s. */
const POLL_MS = 2000;

export type ClaimInput = { asset: string; amount: string; destinationId: string; destinationLabel: string };

export type SubmitOutcome = { type: 'created' } | { type: 'unknown' } | { type: 'rejected'; error: unknown };

type ClaimsContextValue = {
  records: LocalClaim[];
  isSending: (key: string) => boolean;
  /** Saves the claim, then sends it. Resolves after the first attempt; unknown outcomes keep retrying in the background. */
  submit: (input: ClaimInput) => { key: string; firstAttempt: Promise<SubmitOutcome> };
  /** Sends the same key and body again. It can never create a second claim. */
  retry: (key: string) => void;
};

const ClaimsContext = createContext<ClaimsContextValue | null>(null);

/** Mount with `key={token}` so a token change starts from that token's own records. */
export function ClaimsProvider({ token, children }: { token: string | null; children: ReactNode }) {
  const queryClient = useQueryClient();
  const { clearToken } = useToken();
  const storageKey = token === null ? null : localClaimsKey(token);
  const recordsRef = useRef<LocalClaim[] | null>(null);
  if (recordsRef.current === null) {
    recordsRef.current = storageKey ? loadLocalClaims(storageKey) : [];
  }
  const [records, setRecords] = useState(recordsRef.current);
  // The ref is the synchronous guard against double sends; the state re-renders the screens.
  const sendingRef = useRef(new Set<string>());
  const [sending, setSendingState] = useState<ReadonlySet<string>>(new Set());

  // Writes go to storage synchronously, so nothing is lost if the page closes right after.
  function update(change: (records: LocalClaim[]) => LocalClaim[]) {
    const next = change(recordsRef.current ?? []);
    recordsRef.current = next;
    if (storageKey) {
      saveLocalClaims(storageKey, next);
    }
    setRecords(next);
  }

  function patch(key: string, fields: Partial<LocalClaim>) {
    update((current) => current.map((record) => (record.key === key ? { ...record, ...fields } : record)));
  }

  function setSending(key: string, sending: boolean) {
    if (sending) {
      sendingRef.current.add(key);
    } else {
      sendingRef.current.delete(key);
    }
    setSendingState(new Set(sendingRef.current));
  }

  /**
   * `firstSend` is passed only for the very first POST of a new record. Any other send (after a
   * reload, or "Check again") may follow a POST that reached the server, so the claim may exist.
   */
  async function send(key: string, firstSend?: (outcome: SubmitOutcome) => void) {
    if (sendingRef.current.has(key)) {
      return;
    }
    if (token === null) {
      firstSend?.({ type: 'rejected', error: new ApiError('UNAUTHORIZED', 'No API token') });
      return;
    }
    setSending(key, true);
    let report = firstSend;
    let mayExist = firstSend === undefined;
    try {
      for (let attempt = 0; ; attempt++) {
        const record = recordsRef.current?.find((r) => r.key === key);
        if (!record || !isUnresolved(record)) {
          return;
        }
        try {
          const claim = await postClaim(token, key, record.body);
          patch(key, { claim });
          void queryClient.invalidateQueries({ queryKey: ['balances'] });
          report?.({ type: 'created' });
          return;
        } catch (error) {
          const next = afterFailedPost(error, mayExist);
          mayExist = next.mayExist;
          if (next.step === 'rejected') {
            patch(key, { rejected: errorMessage(error) });
            report?.({ type: 'rejected', error });
          } else {
            report?.({ type: 'unknown' });
            report = undefined;
          }
          if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
            // Unresolved records stay saved under this token and resume if it is entered again.
            clearToken('Your token is invalid or has expired. Enter a new one.');
            return;
          }
          if (next.step !== 'retry' || attempt >= RETRY_DELAYS_MS.length) {
            return; // Rejected, or stopped: the status screen offers "Check again".
          }
          const asked = error instanceof ApiError ? (error.retryAfterMs ?? 0) : 0;
          await sleep(Math.max(asked, RETRY_DELAYS_MS[attempt]));
        }
      }
    } finally {
      setSending(key, false);
    }
  }

  function submit(input: ClaimInput) {
    const key = randomUUID();
    const request: ClaimRequest = { asset: input.asset, amount: input.amount, destinationId: input.destinationId };
    const record: LocalClaim = {
      key,
      body: JSON.stringify(request),
      asset: input.asset,
      amount: input.amount,
      destinationLabel: input.destinationLabel,
      confirmedAt: Date.now(),
      claim: null,
      rejected: null,
    };
    update((current) => [record, ...current]); // saved before the first POST
    const firstAttempt = new Promise<SubmitOutcome>((resolve) => {
      void send(key, resolve);
    });
    return { key, firstAttempt };
  }

  // After a reload, finish whatever was still unresolved: same key, same body.
  useEffect(() => {
    for (const record of recordsRef.current ?? []) {
      if (isUnresolved(record)) {
        void send(record.key);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only once per token
  }, []);

  // Follow every pending claim, on any screen, until it completes or fails.
  const pendingIds = records.flatMap((record) => (record.claim?.status === 'pending' ? [record.claim.id] : []));
  useQueries({
    queries: pendingIds.map((id) => ({
      queryKey: ['claim', id],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const claim = await getClaim(token ?? '', id, signal);
        update((current) => current.map((record) => (record.claim?.id === id ? { ...record, claim } : record)));
        if (claim.status !== 'pending') {
          void queryClient.invalidateQueries({ queryKey: ['balances'] });
        }
        return claim;
      },
      refetchInterval: POLL_MS,
      enabled: token !== null,
    })),
  });

  const value: ClaimsContextValue = {
    records,
    isSending: (key) => sending.has(key),
    submit,
    retry: (key) => void send(key),
  };

  return <ClaimsContext.Provider value={value}>{children}</ClaimsContext.Provider>;
}

export function useClaims(): ClaimsContextValue {
  const value = useContext(ClaimsContext);
  if (!value) {
    throw new Error('useClaims must be used inside ClaimsProvider');
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
