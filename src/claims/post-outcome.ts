import { ApiError, isOutcomeUnknown } from '@/api/client';

export type NextStep = {
  /** rejected: nothing was claimed. retry: send the same key again. stop: may exist, wait for "Check again". */
  step: 'rejected' | 'retry' | 'stop';
  /** An attempt with this key may have created the claim. */
  mayExist: boolean;
};

/**
 * What a failed claim POST tells us. `mayExist` is true when an earlier attempt
 * with this key could have reached the server: an unknown result, or a send
 * cut off by a reload.
 */
export function afterFailedPost(error: unknown, mayExist: boolean): NextStep {
  if (!(error instanceof ApiError) || isOutcomeUnknown(error)) {
    return { step: 'retry', mayExist: true }; // this attempt itself may have created the claim
  }
  if (error.code === 'RATE_LIMITED') {
    return { step: 'retry', mayExist }; // not processed; try again after the wait
  }
  if (error.code === 'VALIDATION') {
    // The only proof that nothing exists for this key: an existing claim would have been replayed.
    return { step: 'rejected', mayExist };
  }
  // 401, 404, 409...: this request was refused, but an earlier one may have created the claim.
  return { step: mayExist ? 'stop' : 'rejected', mayExist };
}
