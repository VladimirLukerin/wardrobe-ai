import { closeDatabase, getDatabase } from '../src/db/database';
import { isValidPublicId } from '../src/db/public-id';
import { findUserByPublicId } from '../src/db/users-repository';
import { loadDevWardrobePreset } from '../src/dev-wardrobe-seed/load-preset';
import { readDevWardrobeSeedRecord } from '../src/dev-wardrobe-seed/seed-record';
import { seedDevWardrobeForUser } from '../src/dev-wardrobe-seed/seed-wardrobe';

function parseArgs(argv: string[]) {
  let publicId = '';
  let preset = 'a';
  let replace = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--replace') {
      replace = true;
      continue;
    }

    if (arg.startsWith('--public-id=')) {
      publicId = arg.slice('--public-id='.length).trim();
      continue;
    }

    if (arg === '--public-id') {
      const next = argv[index + 1];

      if (next && !next.startsWith('--')) {
        publicId = next.trim();
        index += 1;
      }

      continue;
    }

    if (arg.startsWith('--preset=')) {
      preset = arg.slice('--preset='.length).trim().toLowerCase();
      continue;
    }

    if (arg === '--preset') {
      const next = argv[index + 1];

      if (next && !next.startsWith('--')) {
        preset = next.trim().toLowerCase();
        index += 1;
      }

      continue;
    }

    if (arg.startsWith('WA-')) {
      publicId = arg.trim();
    }
  }

  return { publicId, preset, replace };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('[DEV WARDROBE SEED] Refusing to run when NODE_ENV=production.');
    process.exit(1);
  }

  getDatabase();

  const { publicId, preset, replace } = parseArgs(process.argv.slice(2));

  if (!publicId) {
    console.error('Usage: npm run dev:seed-wardrobe -- --public-id WA-XXXXXXXX --preset a [--replace]');
    process.exit(1);
  }

  if (!isValidPublicId(publicId)) {
    console.error(`[DEV WARDROBE SEED] Invalid publicId format: ${publicId}`);
    process.exit(1);
  }

  const user = findUserByPublicId(publicId);

  if (!user) {
    console.error(`[DEV WARDROBE SEED] User not found for publicId: ${publicId}`);
    process.exit(1);
  }

  const loadedPreset = loadDevWardrobePreset(preset);
  const existingRecord = readDevWardrobeSeedRecord(user.id);

  console.log('[DEV WARDROBE SEED] Target user:');
  console.log(`  publicId: ${user.public_id}`);
  console.log(`  displayName: ${user.display_name ?? '(none)'}`);
  console.log(`  preset: ${preset} (${loadedPreset.items.length} items, ${loadedPreset.savedOutfits.length} saved outfits)`);

  if (existingRecord && !replace) {
    console.error(
      '[DEV WARDROBE SEED] Seed data already exists for this user. Pass --replace to remove previous seed data first.',
    );
    process.exit(1);
  }

  const result = await seedDevWardrobeForUser({
    userId: user.id,
    publicId: user.public_id,
    preset,
    replace,
  });

  console.log('[DEV WARDROBE SEED] Done.');
  console.log(`  wardrobe items: ${result.itemCount}`);
  console.log(`  wear events: ${result.wearEventCount}`);
  console.log(`  saved outfits: ${result.savedOutfitCount}`);
  console.log(`  seed marker: ${result.record.marker}`);
  console.log(`  seed record: server/data/dev-seed-records/${user.id}.json`);

  closeDatabase();
}

void main().catch((error) => {
  console.error('[DEV WARDROBE SEED] Failed:', error);
  closeDatabase();
  process.exit(1);
});
