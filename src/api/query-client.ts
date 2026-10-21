import { QueryClient } from '@tanstack/react-query';

import { ApiError, ApiErrorCode } from './client';

/** Errors that will not go away by asking again. */
const PERMANENT: ApiErrorCode[] = ['UNAUTHORIZED', 'NOT_FOUND', 'VALIDATION', 'IDEMPOTENCY_MISMATCH', 'UNEXPECTED'];

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          !(error instanceof ApiError && PERMANENT.includes(error.code)) && failureCount < 3,
        // Wait as long as a 429 asks; otherwise back off 1 s, 2 s, 4 s.
        retryDelay: (attempt, error) =>
          (error instanceof ApiError && error.retryAfterMs) || Math.min(1000 * 2 ** attempt, 8000),
      },
      // Never retry blindly: the claim flow repeats a POST itself, with the same Idempotency-Key.
      mutations: { retry: false },
    },
  });
}
