import { closeDatabase, getDatabase } from '../src/db/database';
import { isValidPublicId } from '../src/db/public-id';
import { findUserByPublicId } from '../src/db/users-repository';
import { clearDevWardrobeSeedForUser } from '../src/dev-wardrobe-seed/clear-seed';
import { readDevWardrobeSeedRecord } from '../src/dev-wardrobe-seed/seed-record';

function parseArgs(argv: string[]) {
  let publicId = '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

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

    if (arg.startsWith('WA-')) {
      publicId = arg.trim();
    }
  }

  return { publicId };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('[DEV WARDROBE CLEAR] Refusing to run when NODE_ENV=production.');
    process.exit(1);
  }

  getDatabase();

  const { publicId } = parseArgs(process.argv.slice(2));

  if (!publicId) {
    console.error('Usage: npm run dev:clear-seed-wardrobe -- --public-id WA-XXXXXXXX');
    process.exit(1);
  }

  if (!isValidPublicId(publicId)) {
    console.error(`[DEV WARDROBE CLEAR] Invalid publicId format: ${publicId}`);
    process.exit(1);
  }

  const user = findUserByPublicId(publicId);

  if (!user) {
    console.error(`[DEV WARDROBE CLEAR] User not found for publicId: ${publicId}`);
    process.exit(1);
  }

  const existingRecord = readDevWardrobeSeedRecord(user.id);

  console.log('[DEV WARDROBE CLEAR] Target user:');
  console.log(`  publicId: ${user.public_id}`);
  console.log(`  displayName: ${user.display_name ?? '(none)'}`);

  if (!existingRecord) {
    console.log('[DEV WARDROBE CLEAR] No DEV seed record found. Nothing to remove.');
    closeDatabase();
    return;
  }

  const result = await clearDevWardrobeSeedForUser(user.id);

  console.log('[DEV WARDROBE CLEAR] Done.');
  console.log(`  removed wardrobe items: ${result.removedItems}`);
  console.log(`  removed saved outfits: ${result.removedOutfits}`);
  console.log(`  removed wear events: ${result.removedWearEvents}`);
  console.log(`  removed image files: ${result.removedImages}`);

  closeDatabase();
}

void main().catch((error) => {
  console.error('[DEV WARDROBE CLEAR] Failed:', error);
  closeDatabase();
  process.exit(1);
});
