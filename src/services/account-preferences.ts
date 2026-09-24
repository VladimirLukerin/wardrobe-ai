import { CURRENT_USER_PREFERENCES_ENDPOINT } from '@/config/api';
import type { BodyParameters } from '@/constants/body-parameters';
import type { StylistPreferences } from '@/constants/stylist-preferences';
import { AccountApiError, apiFetch } from '@/services/account';

export type ServerPreferences = {
  displayName: string | null;
  bodyParameters: BodyParameters | null;
  stylistPreferences: StylistPreferences | null;
  updatedAt: string | null;
};

export type PutPreferencesInput = {
  displayName: string;
  bodyParameters: BodyParameters;
  stylistPreferences: StylistPreferences;
  clientUpdatedAt?: string | null;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;

    throw new AccountApiError(response.status, message);
  }

  return payload as T;
}

export async function getPreferences(token: string): Promise<ServerPreferences> {
  const response = await apiFetch(CURRENT_USER_PREFERENCES_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJsonResponse<ServerPreferences>(response);
}

export async function putPreferences(
  token: string,
  input: PutPreferencesInput,
): Promise<ServerPreferences> {
  const response = await apiFetch(CURRENT_USER_PREFERENCES_ENDPOINT, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  return parseJsonResponse<ServerPreferences>(response);
}
