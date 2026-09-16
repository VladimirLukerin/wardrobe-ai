import {
  EMAIL_LINK_DEV_BYPASS_ENDPOINT,
  EMAIL_LINK_REQUEST_CODE_ENDPOINT,
  EMAIL_LINK_VERIFY_ENDPOINT,
  EMAIL_LOGIN_DEV_BYPASS_ENDPOINT,
  EMAIL_LOGIN_REQUEST_CODE_ENDPOINT,
  EMAIL_LOGIN_VERIFY_ENDPOINT,
} from '@/config/api';
import { AccountApiError, type ServerUser } from '@/services/account';
import { NETWORK_ERROR_MESSAGE, isNetworkFailure, warnNetworkFailure } from '@/utils/network-error';
import { getAuthToken } from '@/storage/auth-token-storage';

export type EmailLinkRequestCodeResponse = {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  devBypassAvailable?: boolean;
};

export type EmailLinkVerifyResponse = {
  user: ServerUser;
};

export type EmailLoginVerifyResponse = {
  user: ServerUser;
  token: string;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: string; code?: string; resendAfterSeconds?: number }
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

export async function requestEmailLinkCode(email: string): Promise<EmailLinkRequestCodeResponse> {
  const token = await getAuthToken();

  if (!token) {
    throw new AccountApiError(0, 'Нет соединения с сервером');
  }

  let response: Response;

  try {
    response = await fetch(EMAIL_LINK_REQUEST_CODE_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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

  return parseJsonResponse<EmailLinkRequestCodeResponse>(response);
}

export async function verifyEmailLinkCode({
  challengeId,
  code,
}: {
  challengeId: string;
  code: string;
}): Promise<EmailLinkVerifyResponse> {
  const token = await getAuthToken();

  if (!token) {
    throw new AccountApiError(0, 'Нет соединения с сервером');
  }

  let response: Response;

  try {
    response = await fetch(EMAIL_LINK_VERIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ challengeId, code }),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('AUTH', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  return parseJsonResponse<EmailLinkVerifyResponse>(response);
}

export async function requestEmailLoginCode(email: string): Promise<EmailLinkRequestCodeResponse> {
  let response: Response;

  try {
    response = await fetch(EMAIL_LOGIN_REQUEST_CODE_ENDPOINT, {
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

  return parseJsonResponse<EmailLinkRequestCodeResponse>(response);
}

export async function verifyEmailLoginCode({
  challengeId,
  code,
}: {
  challengeId: string;
  code: string;
}): Promise<EmailLoginVerifyResponse> {
  let response: Response;

  try {
    response = await fetch(EMAIL_LOGIN_VERIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId, code }),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('AUTH', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  return parseJsonResponse<EmailLoginVerifyResponse>(response);
}

export async function devBypassEmailLinkCode(challengeId: string): Promise<EmailLinkVerifyResponse> {
  const token = await getAuthToken();

  if (!token) {
    throw new AccountApiError(0, 'Нет соединения с сервером');
  }

  let response: Response;

  try {
    response = await fetch(EMAIL_LINK_DEV_BYPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ challengeId }),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('AUTH', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  return parseJsonResponse<EmailLinkVerifyResponse>(response);
}

export async function devBypassEmailLoginCode(
  challengeId: string,
): Promise<EmailLoginVerifyResponse> {
  let response: Response;

  try {
    response = await fetch(EMAIL_LOGIN_DEV_BYPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId }),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('AUTH', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  return parseJsonResponse<EmailLoginVerifyResponse>(response);
}
