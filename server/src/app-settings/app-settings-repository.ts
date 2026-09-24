import { getDatabase } from '../db/database';
import type { AppSettingKey } from './app-settings-keys';

export type AppSettingRow = {
  key: AppSettingKey;
  valueJson: string;
  updatedAt: string;
  updatedByAdminId: string | null;
};

export function readAppSettingRow(key: AppSettingKey): AppSettingRow | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT key, value_json AS valueJson, updated_at AS updatedAt, updated_by_admin_id AS updatedByAdminId
       FROM app_settings
       WHERE key = ?`,
    )
    .get(key) as AppSettingRow | undefined;

  return row ?? null;
}

export function readAllAppSettingRows(): AppSettingRow[] {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT key, value_json AS valueJson, updated_at AS updatedAt, updated_by_admin_id AS updatedByAdminId
       FROM app_settings`,
    )
    .all() as AppSettingRow[];
}

export function upsertAppSettingRow(params: {
  key: AppSettingKey;
  valueJson: string;
  updatedByAdminId: string;
}): void {
  const db = getDatabase();
  const updatedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO app_settings (key, value_json, updated_at, updated_by_admin_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at,
       updated_by_admin_id = excluded.updated_by_admin_id`,
  ).run(params.key, params.valueJson, updatedAt, params.updatedByAdminId);
}

export function clearAppSettingsForTests(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM app_settings').run();
}
