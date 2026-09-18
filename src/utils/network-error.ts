export const NETWORK_ERROR_TITLE = 'Не удалось связаться с сервером';
export const NETWORK_ERROR_HINT = 'Проверьте подключение и попробуйте ещё раз.';
export const NETWORK_ERROR_MESSAGE = `${NETWORK_ERROR_TITLE}. ${NETWORK_ERROR_HINT}`;
export const RETRY_LABEL = 'Повторить';

// Messages produced by RN's global fetch (TypeError), expo/fetch ("fetch failed: <native>"),
// iOS NSURLError descriptions, Android OkHttp/socket errors and browser fetch.
const NETWORK_FAILURE_PATTERNS: RegExp[] = [
  // expo/fetch wraps every native transport failure as "fetch failed: <reason>".
  /^fetch failed/,
  /network request failed/,
  /failed to fetch/,
  /load failed/,
  /network error/,
  /network is unreachable/,
  /network connection was lost/,
  /internet connection appears to be offline/,
  /could not connect/,
  /failed to connect/,
  /connection refused/,
  /connection reset/,
  /connection abort/,
  /connection closed/,
  /unable to resolve host/,
  /hostname could not be found/,
  /name or service not known/,
  /no address associated with hostname/,
  /timed out/,
  /timeout/,
  /socket/,
  /econnrefused|econnreset|etimedout|enotfound|ehostunreach|enetunreach|eai_again|epipe/,
  /ssl handshake|tls handshake/,
  /operation was aborted/,
  /request aborted/,
];

const NETWORK_ERROR_NAMES = new Set(['AbortError', 'TimeoutError', 'NetworkError', 'FetchError']);

function collectErrorMessages(error: unknown, depth = 0): string[] {
  if (depth > 4 || error === null || error === undefined) {
    return [];
  }

  if (typeof error === 'string') {
    return [error];
  }

  if (typeof error !== 'object') {
    return [];
  }

  const messages: string[] = [];
  const record = error as { message?: unknown; cause?: unknown };

  if (typeof record.message === 'string') {
    messages.push(record.message);
  }

  if (record.cause !== undefined && record.cause !== error) {
    messages.push(...collectErrorMessages(record.cause, depth + 1));
  }

  return messages;
}

/**
 * True for connectivity problems (offline, unreachable host, refused connection, timeout, abort).
 * False for HTTP errors returned by the server and for anything that looks like a code bug.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (error === null || error === undefined) {
    return false;
  }

  if (typeof error === 'object' && typeof (error as { name?: unknown }).name === 'string') {
    if (NETWORK_ERROR_NAMES.has((error as { name: string }).name)) {
      return true;
    }
  }

  const haystack = collectErrorMessages(error).join(' | ').toLowerCase();

  if (!haystack) {
    return false;
  }

  return NETWORK_FAILURE_PATTERNS.some((pattern) => pattern.test(haystack));
}

/** DEV-only console.warn for expected connectivity failures; never console.error (avoids LogBox red overlay). */
export function warnNetworkFailure(scope: string, error: unknown): void {
  if (!__DEV__) {
    return;
  }

  const message = collectErrorMessages(error)[0] ?? String(error);

  console.warn(`[${scope}] network unavailable: ${message}`);
}

export class ClientNetworkError extends Error {
  readonly code = 'network' as const;

  constructor(message: string = NETWORK_ERROR_TITLE) {
    super(message);
    this.name = 'ClientNetworkError';
  }
}

export function isServerUnavailableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export function isClientNetworkError(error: unknown): error is ClientNetworkError {
  return error instanceof ClientNetworkError;
}

export function isRetryableNetworkError(error: unknown): boolean {
  if (isClientNetworkError(error)) {
    return true;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    isServerUnavailableStatus((error as { status: number }).status)
  ) {
    return true;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'network'
  ) {
    return true;
  }

  return isNetworkFailure(error);
}

export function logExpectedNetworkFailure(context: string, detail?: unknown): void {
  warnNetworkFailure(context, detail);
}

export async function performFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('FETCH', error);
      throw new ClientNetworkError();
    }

    throw error;
  }
}

export function throwIfServerUnavailable(context: string, response: Response): void {
  if (isServerUnavailableStatus(response.status)) {
    warnNetworkFailure(context, `status ${response.status}`);
    throw new ClientNetworkError();
  }
}
