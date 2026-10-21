import { ApiError, ApiErrorCode } from '@/api/client';

import { afterFailedPost } from './post-outcome';

const apiError = (code: ApiErrorCode) => new ApiError(code, code);

/** Runs a sequence of failed attempts for one key, like the send loop does. */
function afterAttempts(codes: ApiErrorCode[], mayExist = false) {
  let state = { step: 'retry' as string, mayExist };
  for (const code of codes) {
    state = afterFailedPost(apiError(code), state.mayExist);
  }
  return state;
}

describe('afterFailedPost', () => {
  it.each(['TIMEOUT', 'SERVER', 'NETWORK', 'BAD_RESPONSE'] as const)('%s may have created the claim: retry', (code) => {
    expect(afterFailedPost(apiError(code), false)).toEqual({ step: 'retry', mayExist: true });
  });

  it('treats an unexpected exception as unknown too', () => {
    expect(afterFailedPost(new TypeError('boom'), false)).toEqual({ step: 'retry', mayExist: true });
  });

  it('retries a 429 without changing what we know', () => {
    expect(afterFailedPost(apiError('RATE_LIMITED'), false)).toEqual({ step: 'retry', mayExist: false });
    expect(afterFailedPost(apiError('RATE_LIMITED'), true)).toEqual({ step: 'retry', mayExist: true });
  });

  it.each(['UNAUTHORIZED', 'IDEMPOTENCY_MISMATCH', 'NOT_FOUND', 'UNEXPECTED'] as const)(
    '%s on the first attempt: nothing was claimed',
    (code) => {
      expect(afterFailedPost(apiError(code), false).step).toBe('rejected');
    },
  );

  it.each(['UNAUTHORIZED', 'IDEMPOTENCY_MISMATCH', 'NOT_FOUND', 'UNEXPECTED'] as const)(
    '%s after an unknown attempt: the claim may exist, so stop and keep it unknown',
    (code) => {
      expect(afterAttempts(['TIMEOUT', code])).toEqual({ step: 'stop', mayExist: true });
    },
  );

  it('keeps it unknown through a 429 between the timeout and the 401', () => {
    expect(afterAttempts(['NETWORK', 'RATE_LIMITED', 'UNAUTHORIZED'])).toEqual({ step: 'stop', mayExist: true });
  });

  it('a send resumed after a reload starts as "may exist"', () => {
    expect(afterAttempts(['UNAUTHORIZED'], true).step).toBe('stop');
  });

  it('a 400 proves nothing was claimed, even after an unknown attempt', () => {
    expect(afterAttempts(['TIMEOUT', 'VALIDATION'])).toEqual({ step: 'rejected', mayExist: true });
  });
});
