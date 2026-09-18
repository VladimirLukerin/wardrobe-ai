import { outfitFeedbackEndpoint } from '@/config/api';
import type { OutfitFeedback, SaveOutfitFeedbackInput } from '@/constants/outfit-feedback';
import { AccountApiError } from '@/services/account';
import {
  ClientNetworkError,
  isServerUnavailableStatus,
  logExpectedNetworkFailure,
  performFetch,
  throwIfServerUnavailable,
} from '@/utils/network-error';

function parseOutfitFeedback(value: unknown): OutfitFeedback | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const feedback = value as Record<string, unknown>;

  if (
    typeof feedback.recommendationKey !== 'string' ||
    !Array.isArray(feedback.itemIds) ||
    (feedback.rating !== 'like' && feedback.rating !== 'dislike') ||
    typeof feedback.createdAt !== 'string' ||
    typeof feedback.updatedAt !== 'string'
  ) {
    return null;
  }

  const reason =
    feedback.reason === null ||
    feedback.reason === 'combination_disliked' ||
    feedback.reason === 'too_familiar' ||
    feedback.reason === 'too_unusual' ||
    feedback.reason === 'weather_mismatch' ||
    feedback.reason === 'item_disliked' ||
    feedback.reason === 'other'
      ? feedback.reason
      : null;

  return {
    recommendationKey: feedback.recommendationKey,
    itemIds: feedback.itemIds.filter((itemId): itemId is string => typeof itemId === 'string'),
    rating: feedback.rating,
    reason,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
  };
}

export async function fetchOutfitFeedback(
  token: string,
  recommendationKey: string,
): Promise<OutfitFeedback | null> {
  const url = new URL(outfitFeedbackEndpoint());
  url.searchParams.set('recommendationKey', recommendationKey);

  const response = await performFetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  throwIfServerUnavailable('OUTFIT FEEDBACK', response);

  if (response.status === 404) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | { feedback?: unknown; error?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;

    if (isServerUnavailableStatus(response.status)) {
      logExpectedNetworkFailure('OUTFIT FEEDBACK', `status ${response.status}`);
      throw new ClientNetworkError();
    }

    throw new AccountApiError(response.status, message);
  }

  return parseOutfitFeedback(payload?.feedback);
}

export async function saveOutfitFeedback(
  token: string,
  recommendationKey: string,
  input: SaveOutfitFeedbackInput,
): Promise<OutfitFeedback> {
  const response = await performFetch(outfitFeedbackEndpoint(recommendationKey), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemIds: input.itemIds,
      rating: input.rating,
      ...(input.reason ? { reason: input.reason } : {}),
    }),
  });

  throwIfServerUnavailable('OUTFIT FEEDBACK', response);

  const payload = (await response.json().catch(() => null)) as
    | { feedback?: unknown; error?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;

    if (isServerUnavailableStatus(response.status)) {
      logExpectedNetworkFailure('OUTFIT FEEDBACK', `status ${response.status}`);
      throw new ClientNetworkError();
    }

    throw new AccountApiError(response.status, message);
  }

  const feedback = parseOutfitFeedback(payload?.feedback);

  if (!feedback) {
    throw new AccountApiError(response.status, 'Invalid feedback response.');
  }

  return feedback;
}
