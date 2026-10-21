import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/api/client';
import { readItem, writeItem } from '@/storage';

const TOKEN_KEY = 'cashmine.token';

type TokenContextValue = {
  token: string | null;
  /** Why the user was sent back to the token screen, for example an expired token. */
  notice: string | null;
  setToken: (token: string) => void;
  clearToken: (notice?: string) => void;
};

const TokenContext = createContext<TokenContextValue | null>(null);

export function TokenProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState(() => readItem(TOKEN_KEY));
  const [notice, setNotice] = useState<string | null>(null);

  // Data belongs to one token, so a token change drops everything cached for the old one.
  const setToken = useCallback(
    (next: string) => {
      queryClient.clear();
      writeItem(TOKEN_KEY, next);
      setNotice(null);
      setTokenState(next);
    },
    [queryClient],
  );

  const clearToken = useCallback(
    (reason?: string) => {
      queryClient.clear();
      writeItem(TOKEN_KEY, null);
      setNotice(reason ?? null);
      setTokenState(null);
    },
    [queryClient],
  );

  // Any 401 means the token is invalid or expired: send the user to the token screen.
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (
          event.type === 'updated' &&
          event.action.type === 'error' &&
          event.action.error instanceof ApiError &&
          event.action.error.code === 'UNAUTHORIZED'
        ) {
          // Deferred: clearing the cache from inside its own listener is not safe.
          setTimeout(() => clearToken('Your token is invalid or has expired. Enter a new one.'));
        }
      }),
    [queryClient, clearToken],
  );

  const value = useMemo(() => ({ token, notice, setToken, clearToken }), [token, notice, setToken, clearToken]);

  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
}

export function useToken(): TokenContextValue {
  const value = useContext(TokenContext);
  if (!value) {
    throw new Error('useToken must be used inside TokenProvider');
  }
  return value;
}

/** For screens behind the token guard, where a token is always set. */
export function useApiToken(): string {
  const { token } = useToken();
  if (token === null) {
    throw new Error('No API token');
  }
  return token;
}
