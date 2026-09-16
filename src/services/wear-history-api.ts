import { WEAR_HISTORY_ENDPOINT, WEAR_HISTORY_SYNC_ENDPOINT } from '@/config/api';
import { AccountApiError } from '@/services/account';

export type WearEventMetadata = {
  id: string;
  outfitId: string;
  itemIds: string[];
  wornAt: string;
  updatedAt: string;
};

export type WearEventDeletedMetadata = {
  id: string;
  deletedAt: string;
};

export type WearHistorySnapshot = {
  events: WearEventMetadata[];
  deletedEvents: WearEventDeletedMetadata[];
  serverTime: string;
};

export type WearHistorySyncEventPayload = {
  id: string;
  outfitId: string;
  itemIds: string[];
  wornAt: string;
  clientUpdatedAt: string;
};

export type WearHistorySyncDeletePayload = {
  id: string;
  clientDeletedAt: string;
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

export async function fetchWearHistorySnapshot(token: string): Promise<WearHistorySnapshot> {
  const response = await fetch(WEAR_HISTORY_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJsonResponse<WearHistorySnapshot>(response);
}

export async function postWearHistorySync(
  token: string,
  payload: {
    events: WearHistorySyncEventPayload[];
    deletedEvents: WearHistorySyncDeletePayload[];
  },
): Promise<WearHistorySnapshot> {
  const response = await fetch(WEAR_HISTORY_SYNC_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<WearHistorySnapshot>(response);
}
