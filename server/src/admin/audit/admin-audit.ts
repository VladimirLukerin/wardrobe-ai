import type { Request } from 'express';

import { appendAdminAuditLog } from './admin-audit-repository';

export function getAdminAuditClientIp(req: Request): string | null {
  return req.socket.remoteAddress ?? null;
}

export function recordAdminAudit(
  req: Request,
  entry: {
    adminUserId: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): void {
  appendAdminAuditLog({
    adminUserId: entry.adminUserId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
    ip: getAdminAuditClientIp(req),
  });
}
