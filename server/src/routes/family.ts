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
} from '../db/family-repository';
import { requireAuth } from '../middleware/auth';

const familyRouter = Router();

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

  const inviteId = req.params.id;

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

  const inviteId = req.params.id;

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

familyRouter.delete('/family/:memberPublicId', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const memberPublicId = req.params.memberPublicId;

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
