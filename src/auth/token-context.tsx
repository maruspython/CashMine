import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

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

  const value = useMemo<TokenContextValue>(
    () => ({
      token,
      notice,
      // Data belongs to one token, so a token change drops everything cached for the old one.
      setToken: (next) => {
        queryClient.clear();
        writeItem(TOKEN_KEY, next);
        setNotice(null);
        setTokenState(next);
      },
      clearToken: (reason) => {
        queryClient.clear();
        writeItem(TOKEN_KEY, null);
        setNotice(reason ?? null);
        setTokenState(null);
      },
    }),
    [token, notice, queryClient],
  );

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
