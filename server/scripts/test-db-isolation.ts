import fs from 'fs';
import os from 'os';
import path from 'path';

import { closeDatabase, getActiveDatabasePath, resolveDatabasePath } from '../src/db/database';

export function useIsolatedTestDatabase(): { dbPath: string; cleanup: () => void } {
  closeDatabase();

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wardrobe-ai-test-'));
  const dbPath = path.join(directory, 'test.sqlite');
  process.env.WARDROBE_DB_PATH = dbPath;

  return {
    dbPath,
    cleanup() {
      closeDatabase();
      delete process.env.WARDROBE_DB_PATH;

      for (const suffix of ['', '-wal', '-shm']) {
        try {
          fs.unlinkSync(`${dbPath}${suffix}`);
        } catch {
          // ignore missing sidecar files
        }
      }

      try {
        fs.rmdirSync(directory);
      } catch {
        // ignore
      }
    },
  };
}

export function assertAdminTestsUseIsolatedDatabase(expectedPath: string): void {
  const activePath = getActiveDatabasePath();
  const resolvedPath = resolveDatabasePath();
  const defaultDevPath = path.resolve(path.join(__dirname, '../data/wardrobe-ai.sqlite'));

  if (path.resolve(expectedPath) === defaultDevPath) {
    throw new Error('Admin tests must not use the default dev database path.');
  }

  if (resolvedPath !== expectedPath) {
    throw new Error('Admin tests must use an isolated SQLite database path.');
  }

  if (activePath !== expectedPath) {
    throw new Error('Active database path does not match isolated test database.');
  }
}
