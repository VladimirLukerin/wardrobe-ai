import type { Request, Response } from 'express';
import { Router } from 'express';

import {
  getOutfitFeedbackForKey,
  upsertOutfitFeedback,
} from '../db/outfit-feedback-repository';
import {
  isOutfitFeedbackRating,
  isOutfitFeedbackReason,
} from '../db/outfit-feedback-reasons';
import { getActiveWardrobeItemsForUser } from '../db/wardrobe-items-repository';
import { requireAuth } from '../middleware/auth';

const outfitFeedbackRouter = Router();

const MAX_RECOMMENDATION_KEY_LENGTH = 256;
const MAX_ITEM_IDS = 20;

function parseRecommendationKeyParam(value: string): string | null {
  const decoded = decodeURIComponent(value).trim();

  if (
    decoded.length === 0 ||
    decoded.length > MAX_RECOMMENDATION_KEY_LENGTH ||
    !/^[a-z0-9:_-]+$/i.test(decoded)
  ) {
    return null;
  }

  return decoded;
}

function parseItemIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEM_IDS) {
    return null;
  }

  const itemIds: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      return null;
    }

    const itemId = entry.trim();

    if (itemIds.includes(itemId)) {
      continue;
    }

    itemIds.push(itemId);
  }

  return itemIds.length >= 2 ? itemIds : null;
}

function validateItemIdsBelongToUser(userId: string, itemIds: string[]): boolean {
  const wardrobeIds = new Set(getActiveWardrobeItemsForUser(userId).map((item) => item.id));

  return itemIds.every((itemId) => wardrobeIds.has(itemId));
}

outfitFeedbackRouter.put('/outfit-feedback/:recommendationKey', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const recommendationKey = parseRecommendationKeyParam(String(req.params.recommendationKey ?? ''));

  if (!recommendationKey) {
    res.status(400).json({ error: 'Invalid recommendation key.' });
    return;
  }

  const itemIds = parseItemIds(req.body?.itemIds);
  const rating = req.body?.rating;
  const rawReason = req.body?.reason;
  const rawTargetItemId = req.body?.targetItemId;

  if (!itemIds) {
    res.status(400).json({ error: 'Invalid itemIds.' });
    return;
  }

  if (!isOutfitFeedbackRating(rating)) {
    res.status(400).json({ error: 'Invalid rating.' });
    return;
  }

  let reason = null;

  if (rawReason !== undefined && rawReason !== null) {
    if (typeof rawReason !== 'string' || !isOutfitFeedbackReason(rawReason)) {
      res.status(400).json({ error: 'Invalid reason.' });
      return;
    }

    reason = rawReason;
  }

  let targetItemId: string | null = null;

  if (reason === 'item_disliked') {
    if (typeof rawTargetItemId !== 'string' || rawTargetItemId.trim().length === 0) {
      res.status(400).json({ error: 'targetItemId is required for item_disliked.' });
      return;
    }

    targetItemId = rawTargetItemId.trim();

    if (!itemIds.includes(targetItemId)) {
      res.status(400).json({ error: 'targetItemId must be included in itemIds.' });
      return;
    }
  } else if (rawTargetItemId !== undefined && rawTargetItemId !== null) {
    res.status(400).json({ error: 'targetItemId is only allowed for item_disliked.' });
    return;
  }

  if (!validateItemIdsBelongToUser(req.authUser.id, itemIds)) {
    res.status(400).json({ error: 'Some itemIds do not belong to the current user.' });
    return;
  }

  const feedback = upsertOutfitFeedback({
    userId: req.authUser.id,
    recommendationKey,
    itemIds,
    rating,
    reason,
    targetItemId,
  });

  res.json({ feedback });
});

outfitFeedbackRouter.get('/outfit-feedback', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const recommendationKey =
    typeof req.query.recommendationKey === 'string'
      ? parseRecommendationKeyParam(req.query.recommendationKey)
      : null;

  if (!recommendationKey) {
    res.status(400).json({ error: 'Invalid recommendation key.' });
    return;
  }

  const feedback = getOutfitFeedbackForKey(req.authUser.id, recommendationKey);

  if (!feedback) {
    res.json({ feedback: null });
    return;
  }

  res.json({ feedback });
});

export { outfitFeedbackRouter };
