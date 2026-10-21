import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '@/config';

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_MISMATCH'
  | 'RATE_LIMITED'
  | 'SERVER'
  | 'TIMEOUT' // 504, or our own timeout
  | 'NETWORK' // no response at all
  | 'BAD_RESPONSE' // a 2xx we could not read
  | 'UNEXPECTED'; // a status the docs do not list

const DOCUMENTED_CODES = new Set<string>([
  'VALIDATION',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'IDEMPOTENCY_MISMATCH',
  'RATE_LIMITED',
  'SERVER',
  'TIMEOUT',
]);

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly field: string | null;
  readonly retryAfterMs: number | null;

  constructor(
    code: ApiErrorCode,
    message: string,
    details: { status?: number | null; field?: string | null; retryAfterMs?: number | null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = details.status ?? null;
    this.field = details.field ?? null;
    this.retryAfterMs = details.retryAfterMs ?? null;
  }
}

/** The server may or may not have done the work. A POST must be repeated with the same Idempotency-Key to find out. */
export function isOutcomeUnknown(error: unknown): boolean {
  return (
    error instanceof ApiError && ['TIMEOUT', 'NETWORK', 'SERVER', 'BAD_RESPONSE'].includes(error.code)
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export type ApiResponse<T> = { data: T; status: number; headers: Headers };

type RequestOptions = {
  method?: 'GET' | 'POST';
  /** Already serialized, so a retry can send exactly the same bytes. */
  body?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export async function apiRequest<T>(token: string, path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel);

  try {
    let response: Response;
    let text: string;
    try {
      response = await fetch(API_BASE_URL + path, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
        body: options.body,
        signal: controller.signal,
      });
      text = await response.text();
    } catch (error) {
      if (options.signal?.aborted) {
        throw error; // cancelled by the caller, not a failure
      }
      if (controller.signal.aborted) {
        throw new ApiError('TIMEOUT', 'The server did not answer in time');
      }
      throw new ApiError('NETWORK', 'Could not reach the server. Check your connection.');
    }

    const body = parseJson(text);
    if (response.ok) {
      if (body === undefined) {
        throw new ApiError('BAD_RESPONSE', 'The server sent a response we could not read', { status: response.status });
      }
      return { data: body as T, status: response.status, headers: response.headers };
    }
    throw errorFromResponse(response, body);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

function errorFromResponse(response: Response, body: unknown): ApiError {
  const error = (body as { error?: Record<string, unknown> } | undefined)?.error;
  const code =
    typeof error?.code === 'string' && DOCUMENTED_CODES.has(error.code)
      ? (error.code as ApiErrorCode)
      : codeForStatus(response.status);
  return new ApiError(code, typeof error?.message === 'string' ? error.message : `Request failed (${response.status})`, {
    status: response.status,
    field: typeof error?.field === 'string' ? error.field : null,
    retryAfterMs: retryAfterMs(response, error),
  });
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 400) return 'VALIDATION';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'IDEMPOTENCY_MISMATCH';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 504) return 'TIMEOUT';
  if (status >= 500) return 'SERVER';
  return 'UNEXPECTED';
}

/** retryAfterMs from the body, else the Retry-After header (seconds). */
function retryAfterMs(response: Response, error: Record<string, unknown> | undefined): number | null {
  if (typeof error?.retryAfterMs === 'number') {
    return error.retryAfterMs;
  }
  const seconds = Number(response.headers.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}
