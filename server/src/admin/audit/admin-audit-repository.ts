import crypto from 'crypto';

import { getDatabase } from '../../db/database';

export type AdminAuditLogEntry = {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata_json: string | null;
  created_at: string;
  ip: string | null;
};

export function appendAdminAuditLog({
  adminUserId,
  action,
  targetType = null,
  targetId = null,
  metadata = null,
  ip = null,
}: {
  adminUserId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}): AdminAuditLogEntry {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  db.prepare(
    `INSERT INTO admin_audit_log (
      id, admin_user_id, action, target_type, target_id, metadata_json, created_at, ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, adminUserId, action, targetType, targetId, metadataJson, createdAt, ip);

  return {
    id,
    admin_user_id: adminUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata_json: metadataJson,
    created_at: createdAt,
    ip,
  };
}

export function findAdminAuditLogByAction(action: string, limit = 20): AdminAuditLogEntry[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM admin_audit_log WHERE action = ? ORDER BY created_at DESC LIMIT ?')
    .all(action, limit) as AdminAuditLogEntry[];
}

export function findAdminAuditLogsForTests(limit = 50): AdminAuditLogEntry[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ?')
    .all(limit) as AdminAuditLogEntry[];
}
