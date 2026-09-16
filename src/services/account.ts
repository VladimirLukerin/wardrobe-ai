import { ANONYMOUS_AUTH_ENDPOINT, CURRENT_USER_ENDPOINT, LOGOUT_ENDPOINT } from '@/config/api';

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

  const response = await fetch(ANONYMOUS_AUTH_ENDPOINT, {
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
  const response = await fetch(CURRENT_USER_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseJsonResponse<MeResponse>(response);

  return payload.user;
}

export async function logoutSession(token: string): Promise<void> {
  const response = await fetch(LOGOUT_ENDPOINT, {
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
