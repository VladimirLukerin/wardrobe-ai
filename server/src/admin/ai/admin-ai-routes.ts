import type { Request, Response } from 'express';
import { Router } from 'express';

import { AI_USAGE_REQUEST_TYPES, AI_USAGE_STATUSES } from '../../ai-usage/ai-usage-types';
import { requireAdminRole, requireAdminSession } from '../middleware/require-admin-session';
import { getAdminAiEvents, getAdminAiSummary, getAdminAiTimeseries } from './admin-ai-service';

export const adminAiRouter = Router();

function parseOptionalIsoQuery(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  return value.trim();
}

function parseRequestType(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  return (AI_USAGE_REQUEST_TYPES as readonly string[]).includes(value)
    ? (value as (typeof AI_USAGE_REQUEST_TYPES)[number])
    : 'invalid';
}

adminAiRouter.get(
  '/ai/summary',
  requireAdminSession,
  requireAdminRole('viewer'),
  (req: Request, res: Response) => {
    const requestType = parseRequestType(req.query.type);

    if (requestType === 'invalid') {
      res.status(400).json({ error: 'Invalid type filter.' });
      return;
    }

    const summary = getAdminAiSummary({
      from: parseOptionalIsoQuery(req.query.from),
      to: parseOptionalIsoQuery(req.query.to),
      requestType,
    });

    res.json(summary);
  },
);

adminAiRouter.get(
  '/ai/timeseries',
  requireAdminSession,
  requireAdminRole('viewer'),
  (req: Request, res: Response) => {
    const requestType = parseRequestType(req.query.type);

    if (requestType === 'invalid') {
      res.status(400).json({ error: 'Invalid type filter.' });
      return;
    }

    const granularity = req.query.granularity === 'hour' ? 'hour' : 'day';

    const points = getAdminAiTimeseries({
      from: parseOptionalIsoQuery(req.query.from),
      to: parseOptionalIsoQuery(req.query.to),
      requestType,
      granularity,
    });

    res.json(points);
  },
);

adminAiRouter.get(
  '/ai/events',
  requireAdminSession,
  requireAdminRole('viewer'),
  (req: Request, res: Response) => {
    const requestType = parseRequestType(req.query.type);

    if (requestType === 'invalid') {
      res.status(400).json({ error: 'Invalid type filter.' });
      return;
    }

    const statusRaw = req.query.status;

    if (
      statusRaw !== undefined &&
      (typeof statusRaw !== 'string' ||
        !(AI_USAGE_STATUSES as readonly string[]).includes(statusRaw))
    ) {
      res.status(400).json({ error: 'Invalid status filter.' });
      return;
    }

    const limitRaw = req.query.limit;
    const limit =
      typeof limitRaw === 'string' && limitRaw.trim()
        ? Number.parseInt(limitRaw, 10)
        : 25;

    if (!Number.isFinite(limit) || limit <= 0) {
      res.status(400).json({ error: 'Invalid limit.' });
      return;
    }

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;

    const result = getAdminAiEvents({
      limit,
      cursor,
      requestType,
      status: typeof statusRaw === 'string' ? statusRaw : null,
    });

    res.json(result);
  },
);
