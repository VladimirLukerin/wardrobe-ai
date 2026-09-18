import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'wardrobe-ai.sqlite');

let database: Database.Database | null = null;

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      public_id TEXT UNIQUE NOT NULL,
      display_name TEXT NULL,
      email TEXT NULL,
      phone TEXT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      body_parameters_json TEXT NOT NULL,
      stylist_preferences_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wardrobe_items (
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      base_name TEXT NOT NULL,
      category TEXT NOT NULL,
      color TEXT NOT NULL,
      pattern TEXT NOT NULL,
      print_description TEXT NULL,
      style TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      image_processing_status TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      PRIMARY KEY (user_id, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_wardrobe_items_user_id ON wardrobe_items(user_id);

    CREATE TABLE IF NOT EXISTS saved_outfits (
      user_id TEXT NOT NULL,
      outfit_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      source TEXT NULL,
      item_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      PRIMARY KEY (user_id, outfit_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_saved_outfits_user_id ON saved_outfits(user_id);

    CREATE TABLE IF NOT EXISTS wear_events (
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      outfit_id TEXT NOT NULL,
      item_ids_json TEXT NOT NULL,
      worn_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      PRIMARY KEY (user_id, event_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_wear_events_user_id ON wear_events(user_id);
  `);

  migrateWardrobeImageColumns(db);
  migrateEmailVerification(db);
  migratePhoneVerification(db);
  migrateFamilyTables(db);
  migrateSavedPairedOutfitsTable(db);
  migrateDailyOutfitsTable(db);
  migrateOutfitFeedbackTable(db);
  migratePasswordCredentials(db);
}

function migrateSavedPairedOutfitsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_paired_outfits (
      owner_user_id TEXT NOT NULL,
      paired_outfit_id TEXT NOT NULL,
      member_user_id TEXT NOT NULL,
      member_public_id TEXT NOT NULL,
      member_display_name TEXT NULL,
      occasion TEXT NOT NULL,
      matching_mode TEXT NOT NULL,
      owner_item_ids_json TEXT NOT NULL,
      member_item_ids_json TEXT NOT NULL,
      explanation TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      PRIMARY KEY (owner_user_id, paired_outfit_id),
      FOREIGN KEY (owner_user_id) REFERENCES users(id),
      FOREIGN KEY (member_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_saved_paired_outfits_owner_user_id
      ON saved_paired_outfits(owner_user_id);
  `);
}

function migratePasswordCredentials(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_password_credentials (
      user_id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

function migrateOutfitFeedbackTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS outfit_feedback (
      feedback_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      recommendation_key TEXT NOT NULL,
      item_ids_json TEXT NOT NULL,
      rating TEXT NOT NULL CHECK (rating IN ('like', 'dislike')),
      reason TEXT NULL,
      target_item_id TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, recommendation_key),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_outfit_feedback_user_id
      ON outfit_feedback(user_id);

    CREATE INDEX IF NOT EXISTS idx_outfit_feedback_user_updated
      ON outfit_feedback(user_id, updated_at DESC);
  `);

  migrateOutfitFeedbackTargetItemColumn(db);
}

function migrateOutfitFeedbackTargetItemColumn(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(outfit_feedback)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('target_item_id')) {
    db.exec('ALTER TABLE outfit_feedback ADD COLUMN target_item_id TEXT NULL');
  }
}

function migrateDailyOutfitsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_outfits (
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      outfit_id TEXT NOT NULL,
      item_ids_json TEXT NOT NULL,
      description TEXT NOT NULL,
      weather_context_json TEXT NULL,
      input_signature TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, local_date),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_outfits_user_id ON daily_outfits(user_id);
  `);
}

function migrateFamilyTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_invites (
      id TEXT PRIMARY KEY,
      sender_user_id TEXT NOT NULL,
      recipient_user_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (sender_user_id) REFERENCES users(id),
      FOREIGN KEY (recipient_user_id) REFERENCES users(id),
      CHECK (sender_user_id != recipient_user_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_family_invites_pending_pair
      ON family_invites(sender_user_id, recipient_user_id)
      WHERE status = 'pending';

    CREATE TABLE IF NOT EXISTS family_members (
      user_id TEXT NOT NULL,
      member_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, member_user_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (member_user_id) REFERENCES users(id),
      CHECK (user_id != member_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
  `);
}

function migrateEmailVerification(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verification_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_sent_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_email_verification_challenges_user_id
      ON email_verification_challenges(user_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_verified_email
      ON users(email)
      WHERE email IS NOT NULL AND email_verified = 1;
  `);
}

function migratePhoneVerification(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS phone_verification_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_sent_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_phone_verification_challenges_user_id
      ON phone_verification_challenges(user_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_verified_phone
      ON users(phone)
      WHERE phone IS NOT NULL AND phone_verified = 1;
  `);
}

function migrateWardrobeImageColumns(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(wardrobe_items)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  const additions = [
    ['original_image_key', 'TEXT NULL'],
    ['processed_image_key', 'TEXT NULL'],
    ['original_image_updated_at', 'TEXT NULL'],
    ['processed_image_updated_at', 'TEXT NULL'],
    ['original_image_content_type', 'TEXT NULL'],
    ['processed_image_content_type', 'TEXT NULL'],
  ] as const;

  for (const [name, definition] of additions) {
    if (!columnNames.has(name)) {
      db.exec(`ALTER TABLE wardrobe_items ADD COLUMN ${name} ${definition}`);
    }
  }
}

export function getDatabase(): Database.Database {
  if (database) {
    return database;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  runMigrations(database);

  return database;
}

export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
  }
}
