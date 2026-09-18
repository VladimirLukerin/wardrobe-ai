import type { Request, Response } from 'express';
import { Router } from 'express';

import {
  acceptFamilyInvite,
  createFamilyInvite,
  listFamilyMembers,
  listIncomingPendingInvites,
  listOutgoingPendingInvites,
  rejectFamilyInvite,
  removeFamilyMember,
  resolveFamilyMemberWardrobeAccess,
} from '../db/family-repository';
import { getActiveWardrobeItemsForUser } from '../db/wardrobe-items-repository';
import { getActiveSavedOutfitsForUser } from '../db/saved-outfits-repository';
import { requireAuth } from '../middleware/auth';
import { suggestPairedOutfitsHandler } from '../paired-outfits/suggest-paired-outfits';
import { sendWardrobeImageDownload } from './wardrobe-image-download';

const familyRouter = Router();

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0) {
    return value[0].trim();
  }

  return null;
}

familyRouter.get('/family', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json({
    members: listFamilyMembers(req.authUser.id),
  });
});

familyRouter.get('/family/invites', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json({
    incoming: listIncomingPendingInvites(req.authUser.id),
    outgoing: listOutgoingPendingInvites(req.authUser.id),
  });
});

familyRouter.post('/family/invite', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const publicId = typeof req.body?.publicId === 'string' ? req.body.publicId : '';

  if (!publicId.trim()) {
    res.status(400).json({ error: 'Укажите ID пользователя.' });
    return;
  }

  const result = createFamilyInvite(req.authUser.id, publicId);

  if ('status' in result) {
    res.status(result.status).json({ error: result.message });
    return;
  }

  res.status(201).json(result.invite);
});

familyRouter.post('/family/invites/:id/accept', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const inviteId = getRouteParam(req.params.id);

  if (!inviteId) {
    res.status(400).json({ error: 'Некорректный идентификатор приглашения.' });
    return;
  }

  const result = acceptFamilyInvite(req.authUser.id, inviteId);

  if ('status' in result) {
    res.status(result.status).json({ error: result.message });
    return;
  }

  res.json({ ok: true });
});

familyRouter.post('/family/invites/:id/reject', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const inviteId = getRouteParam(req.params.id);

  if (!inviteId) {
    res.status(400).json({ error: 'Некорректный идентификатор приглашения.' });
    return;
  }

  const result = rejectFamilyInvite(req.authUser.id, inviteId);

  if ('status' in result) {
    res.status(result.status).json({ error: result.message });
    return;
  }

  res.json({ ok: true });
});

function getFamilyWardrobeItemId(req: Request): string | null {
  const itemId = req.query.itemId;

  return typeof itemId === 'string' && itemId.trim().length > 0 ? itemId.trim() : null;
}

function shortMemberPublicId(publicId: string): string {
  return publicId.slice(0, 8);
}

familyRouter.get('/family/:memberPublicId/wardrobe', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const memberPublicId = getRouteParam(req.params.memberPublicId);

  if (!memberPublicId) {
    res.status(400).json({ error: 'Некорректный ID пользователя.' });
    return;
  }

  const access = resolveFamilyMemberWardrobeAccess(req.authUser.id, memberPublicId);

  if ('status' in access) {
    res.status(access.status).json({ error: access.message });
    return;
  }

  const items = getActiveWardrobeItemsForUser(access.targetUserId);

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[FAMILY WARDROBE] member=${shortMemberPublicId(access.member.publicId)} items=${items.length}`,
    );
  }

  res.json({
    member: access.member,
    items,
  });
});

familyRouter.get('/family/:memberPublicId/outfits', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const memberPublicId = getRouteParam(req.params.memberPublicId);

  if (!memberPublicId) {
    res.status(400).json({ error: 'Некорректный ID пользователя.' });
    return;
  }

  const access = resolveFamilyMemberWardrobeAccess(req.authUser.id, memberPublicId);

  if ('status' in access) {
    res.status(access.status).json({ error: access.message });
    return;
  }

  const outfits = getActiveSavedOutfitsForUser(access.targetUserId);

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[FAMILY OUTFITS] member=${shortMemberPublicId(access.member.publicId)} outfits=${outfits.length}`,
    );
  }

  res.json({
    member: access.member,
    outfits,
  });
});

async function handleFamilyWardrobeImageDownload(
  req: Request,
  res: Response,
  kind: 'original' | 'processed',
): Promise<void> {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const memberPublicId = getRouteParam(req.params.memberPublicId);
  const itemId = getFamilyWardrobeItemId(req);

  if (!memberPublicId || !itemId) {
    res.status(400).json({ error: 'Invalid request.' });
    return;
  }

  const access = resolveFamilyMemberWardrobeAccess(req.authUser.id, memberPublicId);

  if ('status' in access) {
    res.status(access.status).json({ error: access.message });
    return;
  }

  await sendWardrobeImageDownload(res, {
    userId: access.targetUserId,
    itemId,
    kind,
    logTag: 'FAMILY IMAGE',
    memberPublicId,
  });
}

familyRouter.get(
  '/family/:memberPublicId/wardrobe/images/processed',
  requireAuth,
  async (req: Request, res: Response) => {
    await handleFamilyWardrobeImageDownload(req, res, 'processed');
  },
);

familyRouter.get(
  '/family/:memberPublicId/wardrobe/images/original',
  requireAuth,
  async (req: Request, res: Response) => {
    await handleFamilyWardrobeImageDownload(req, res, 'original');
  },
);

familyRouter.post(
  '/family/:memberPublicId/paired-outfits',
  requireAuth,
  suggestPairedOutfitsHandler,
);

familyRouter.delete('/family/:memberPublicId', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const memberPublicId = getRouteParam(req.params.memberPublicId);

  if (!memberPublicId) {
    res.status(400).json({ error: 'Некорректный ID пользователя.' });
    return;
  }

  const result = removeFamilyMember(req.authUser.id, memberPublicId);

  if ('status' in result) {
    res.status(result.status).json({ error: result.message });
    return;
  }

  res.json({ ok: true });
});

export { familyRouter };
