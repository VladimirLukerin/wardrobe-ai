import {
  CHANGE_PASSWORD_ENDPOINT,
  PASSWORD_LOGIN_ENDPOINT,
  PASSWORD_RESET_REQUEST_CODE_ENDPOINT,
  PASSWORD_RESET_VERIFY_ENDPOINT,
  SET_PASSWORD_ENDPOINT,
} from '@/config/api';
import { AccountApiError, getCurrentUser, type ServerUser } from '@/services/account';
import { NETWORK_ERROR_MESSAGE, isNetworkFailure, warnNetworkFailure } from '@/utils/network-error';
import { getAuthToken } from '@/storage/auth-token-storage';

export type PasswordAuthResponse = {
  user: ServerUser;
  token: string;
};

export type PasswordResetRequestCodeResponse = {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  devBypassAvailable?: boolean;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: string; code?: string; retryAfterSeconds?: number }
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

export async function loginWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<PasswordAuthResponse> {
  let response: Response;

  try {
    response = await fetch(PASSWORD_LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('AUTH', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  return parseJsonResponse<PasswordAuthResponse>(response);
}

export async function setPassword(password: string): Promise<void> {
  const token = await getAuthToken();

  if (!token) {
    throw new AccountApiError(0, 'Нет соединения с сервером');
  }

  let response: Response;

  try {
    response = await fetch(SET_PASSWORD_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password }),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('AUTH', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  await parseJsonResponse<{ ok: true }>(response);
}

export async function changePassword({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const token = await getAuthToken();

  if (!token) {
    throw new AccountApiError(0, 'Нет соединения с сервером');
  }

  let response: Response;

  try {
    response = await fetch(CHANGE_PASSWORD_ENDPOINT, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('AUTH', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  await parseJsonResponse<{ ok: true }>(response);
}

export async function requestPasswordResetCode(
  email: string,
): Promise<PasswordResetRequestCodeResponse> {
  let response: Response;

  try {
    response = await fetch(PASSWORD_RESET_REQUEST_CODE_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('AUTH', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  return parseJsonResponse<PasswordResetRequestCodeResponse>(response);
}

export async function verifyPasswordReset({
  challengeId,
  code,
  newPassword,
}: {
  challengeId: string;
  code: string;
  newPassword: string;
}): Promise<PasswordAuthResponse> {
  let response: Response;

  try {
    response = await fetch(PASSWORD_RESET_VERIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId, code, newPassword }),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('AUTH', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  return parseJsonResponse<PasswordAuthResponse>(response);
}

export async function refreshCurrentUserAfterPasswordChange(): Promise<ServerUser> {
  const token = await getAuthToken();

  if (!token) {
    throw new AccountApiError(0, 'Нет соединения с сервером');
  }

  return getCurrentUser(token);
}
