import fs from 'fs';

import type { DevWardrobeSeedRecord } from './types';
import { DEV_WARDROBE_SEED_MARKER, getDevSeedRecordPath, getDevSeedRecordsDir } from './paths';

export function readDevWardrobeSeedRecord(userId: string): DevWardrobeSeedRecord | null {
  const recordPath = getDevSeedRecordPath(userId);

  if (!fs.existsSync(recordPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as DevWardrobeSeedRecord;

    if (parsed.marker !== DEV_WARDROBE_SEED_MARKER || parsed.userId !== userId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeDevWardrobeSeedRecord(record: DevWardrobeSeedRecord): void {
  fs.mkdirSync(getDevSeedRecordsDir(), { recursive: true });
  fs.writeFileSync(getDevSeedRecordPath(record.userId), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

export function deleteDevWardrobeSeedRecord(userId: string): void {
  const recordPath = getDevSeedRecordPath(userId);

  if (fs.existsSync(recordPath)) {
    fs.unlinkSync(recordPath);
  }
}
