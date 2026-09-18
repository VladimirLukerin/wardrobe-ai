import path from 'path';

export const DEV_WARDROBE_SEED_MARKER = 'dev-wardrobe-seed-v1';

export function getDevFixturesRoot(): string {
  return path.join(__dirname, '../../dev-fixtures/wardrobe');
}

export function getDevFixtureImagesDir(): string {
  return path.join(getDevFixturesRoot(), 'images');
}

export function getDevSeedRecordsDir(): string {
  return path.join(__dirname, '../../data/dev-seed-records');
}

export function getDevSeedRecordPath(userId: string): string {
  return path.join(getDevSeedRecordsDir(), `${userId}.json`);
}

export function getDevWardrobePresetPath(preset: string): string {
  return path.join(getDevFixturesRoot(), `wardrobe-${preset}.json`);
}
