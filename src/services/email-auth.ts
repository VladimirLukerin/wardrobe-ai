import {
  EMAIL_LINK_REQUEST_CODE_ENDPOINT,
  EMAIL_LINK_VERIFY_ENDPOINT,
  EMAIL_LOGIN_REQUEST_CODE_ENDPOINT,
  EMAIL_LOGIN_VERIFY_ENDPOINT,
} from '@/config/api';
import { AccountApiError, type ServerUser } from '@/services/account';
import { getAuthToken } from '@/storage/auth-token-storage';

export type EmailLinkRequestCodeResponse = {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

export type EmailLinkVerifyResponse = {
  user: ServerUser;
};

export type EmailLoginVerifyResponse = {
  user: ServerUser;
  token: string;
};

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    return (
      message.includes('network request failed') ||
      message.includes('failed to fetch') ||
      message.includes('network error') ||
      message.includes('timeout')
    );
  }

  return false;
}

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
      throw new AccountApiError(0, 'Не удалось подключиться к серверу');
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
      throw new AccountApiError(0, 'Не удалось подключиться к серверу');
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
      throw new AccountApiError(0, 'Не удалось подключиться к серверу');
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
      throw new AccountApiError(0, 'Не удалось подключиться к серверу');
    }

    throw error;
  }

  return parseJsonResponse<EmailLoginVerifyResponse>(response);
}
