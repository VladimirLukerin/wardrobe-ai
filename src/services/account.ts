import { ANONYMOUS_AUTH_ENDPOINT, CURRENT_USER_ENDPOINT, LOGOUT_ENDPOINT } from '@/config/api';
import {
  NETWORK_ERROR_MESSAGE,
  isNetworkFailure,
  warnNetworkFailure,
} from '@/utils/network-error';

export type ServerUser = {
  id: string;
  publicId: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  createdAt: string;
};

type AuthResponse = {
  user: ServerUser;
  token: string;
};

type MeResponse = {
  user: ServerUser;
};

export class AccountApiError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = 'AccountApiError';
    this.status = status;
    this.code = code;
  }

  /** status 0 = request never reached the server (offline, refused, timeout). */
  static isNetwork(error: unknown): error is AccountApiError {
    return error instanceof AccountApiError && error.status === 0;
  }
}

/**
 * fetch() that converts connectivity failures into AccountApiError(status 0, code 'network').
 * Anything else (programming errors) is rethrown untouched.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('API', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: string; code?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    const code =
      payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string'
        ? payload.code
        : null;

    throw new AccountApiError(response.status, message, code);
  }

  return payload as T;
}

export async function createAnonymousAccount(
  displayName?: string,
): Promise<{ user: ServerUser; token: string }> {
  const body =
    displayName && displayName.trim().length > 0 ? { displayName: displayName.trim() } : {};

  const response = await apiFetch(ANONYMOUS_AUTH_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await parseJsonResponse<AuthResponse>(response);

  return {
    user: payload.user,
    token: payload.token,
  };
}

export async function getCurrentUser(token: string): Promise<ServerUser> {
  const response = await apiFetch(CURRENT_USER_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseJsonResponse<MeResponse>(response);

  return payload.user;
}

export async function updateCurrentUserDisplayName(
  token: string,
  displayName: string,
): Promise<ServerUser> {
  const response = await apiFetch(CURRENT_USER_ENDPOINT, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ displayName }),
  });

  const payload = await parseJsonResponse<MeResponse>(response);

  return payload.user;
}

export async function logoutSession(token: string): Promise<void> {
  const response = await apiFetch(LOGOUT_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    await parseJsonResponse(response);
  }
}
