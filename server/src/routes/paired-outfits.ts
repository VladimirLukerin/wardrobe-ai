import type { Request, Response } from 'express';
import { Router } from 'express';

import { resolveFamilyMemberWardrobeAccess } from '../db/family-repository';
import {
  createSavedPairedOutfit,
  deleteSavedPairedOutfit,
  getSavedPairedOutfitById,
  isSavedPairedOutfitMatchingMode,
  listSavedPairedOutfits,
} from '../db/saved-paired-outfits-repository';
import { verifyActiveItemIdsForUser } from '../db/wardrobe-items-repository';
import { requireAuth } from '../middleware/auth';

const pairedOutfitsRouter = Router();

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0) {
    return value[0].trim();
  }

  return null;
}

function parseItemIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const itemIds = value.filter((entry): entry is string => typeof entry === 'string');

  if (itemIds.length === 0) {
    return null;
  }

  return [...new Set(itemIds)];
}

pairedOutfitsRouter.get('/paired-outfits', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json({
    outfits: listSavedPairedOutfits(req.authUser.id),
  });
});

pairedOutfitsRouter.get('/paired-outfits/:id', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const pairedOutfitId = getRouteParam(req.params.id);

  if (!pairedOutfitId) {
    res.status(400).json({ error: 'Некорректный идентификатор.' });
    return;
  }

  const outfit = getSavedPairedOutfitById(req.authUser.id, pairedOutfitId);

  if (!outfit) {
    res.status(404).json({ error: 'Совместный образ не найден.' });
    return;
  }

  res.json({ outfit });
});

pairedOutfitsRouter.post('/paired-outfits', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const memberPublicId =
    typeof req.body?.memberPublicId === 'string' ? req.body.memberPublicId.trim() : '';
  const occasion = typeof req.body?.occasion === 'string' ? req.body.occasion.trim() : '';
  const matchingMode =
    typeof req.body?.matchingMode === 'string' ? req.body.matchingMode.trim() : '';
  const explanation = typeof req.body?.explanation === 'string' ? req.body.explanation.trim() : '';
  const ownerItemIds = parseItemIds(req.body?.ownerItemIds);
  const memberItemIds = parseItemIds(req.body?.memberItemIds);

  if (!memberPublicId || !occasion || !isSavedPairedOutfitMatchingMode(matchingMode)) {
    res.status(400).json({ error: 'Некорректное тело запроса.' });
    return;
  }

  if (!ownerItemIds || !memberItemIds) {
    res.status(400).json({ error: 'Укажите вещи для обоих образов.' });
    return;
  }

  const access = resolveFamilyMemberWardrobeAccess(req.authUser.id, memberPublicId);

  if ('status' in access) {
    res.status(access.status).json({ error: access.message });
    return;
  }

  if (
    !verifyActiveItemIdsForUser(req.authUser.id, ownerItemIds) ||
    !verifyActiveItemIdsForUser(access.targetUserId, memberItemIds)
  ) {
    res.status(400).json({ error: 'Некоторые вещи недоступны или не принадлежат указанным пользователям.' });
    return;
  }

  const outfit = createSavedPairedOutfit({
    ownerUserId: req.authUser.id,
    memberUserId: access.targetUserId,
    memberPublicId: access.member.publicId,
    memberDisplayName: access.member.displayName,
    occasion,
    matchingMode,
    ownerItemIds,
    memberItemIds,
    explanation,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SAVED PAIR OUTFIT] created id=${outfit.id.slice(0, 8)} member=${memberPublicId.slice(0, 8)}`);
  }

  res.status(201).json({ outfit });
});

pairedOutfitsRouter.delete('/paired-outfits/:id', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const pairedOutfitId = getRouteParam(req.params.id);

  if (!pairedOutfitId) {
    res.status(400).json({ error: 'Некорректный идентификатор.' });
    return;
  }

  const deleted = deleteSavedPairedOutfit(req.authUser.id, pairedOutfitId);

  if (!deleted) {
    res.status(404).json({ error: 'Совместный образ не найден.' });
    return;
  }

  res.json({ ok: true });
});

export { pairedOutfitsRouter };
