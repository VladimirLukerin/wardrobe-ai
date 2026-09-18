import { generateDevFixtureImageIfMissing } from '../src/dev-wardrobe-seed/ensure-fixture-image';
import type { FixtureImageMetadata } from '../src/dev-wardrobe-seed/fixture-image-types';
import {
  SUPPORTED_PATTERNS,
  SUPPORTED_SILHOUETTES,
} from '../src/dev-wardrobe-seed/fixture-image-types';
import {
  resolveFixturePatternKind,
  resolveFixtureSilhouetteType,
} from '../src/dev-wardrobe-seed/generate-fixture-image';
import { loadDevWardrobePreset } from '../src/dev-wardrobe-seed/load-preset';
import { getDevFixtureImagesDir } from '../src/dev-wardrobe-seed/paths';

const PRESETS = ['a', 'b'];

function toFixtureMetadata(item: {
  fixtureId: string;
  image: string;
  category: string;
  baseName: string;
  color: string;
  pattern: string;
  printDescription: string | null;
}): FixtureImageMetadata {
  return {
    fixtureId: item.fixtureId,
    image: item.image,
    category: item.category,
    baseName: item.baseName,
    color: item.color,
    pattern: item.pattern,
    printDescription: item.printDescription,
  };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('[DEV FIXTURES] Refusing to run when NODE_ENV=production.');
    process.exit(1);
  }

  const uniqueFixtures = new Map<string, FixtureImageMetadata>();

  for (const preset of PRESETS) {
    const loaded = loadDevWardrobePreset(preset);

    for (const item of loaded.items) {
      if (!uniqueFixtures.has(item.image)) {
        uniqueFixtures.set(item.image, toFixtureMetadata(item));
      }
    }
  }

  let created = 0;
  let skipped = 0;
  const silhouettesUsed = new Set<string>();
  const patternsUsed = new Set<string>();

  for (const metadata of uniqueFixtures.values()) {
    silhouettesUsed.add(resolveFixtureSilhouetteType(metadata));
    patternsUsed.add(resolveFixturePatternKind(metadata));

    const result = await generateDevFixtureImageIfMissing(metadata);

    if (result === 'created') {
      created += 1;
    } else {
      skipped += 1;
    }
  }

  console.log('[DEV FIXTURES] Done.');
  console.log(`  images dir: ${getDevFixtureImagesDir()}`);
  console.log(`  unique fixtures: ${uniqueFixtures.size}`);
  console.log(`  created: ${created}`);
  console.log(`  skipped existing: ${skipped}`);
  console.log(`  silhouettes supported: ${SUPPORTED_SILHOUETTES.join(', ')}`);
  console.log(`  patterns supported: ${SUPPORTED_PATTERNS.join(', ')}`);
  console.log(`  silhouettes used: ${[...silhouettesUsed].sort().join(', ')}`);
  console.log(`  patterns used: ${[...patternsUsed].sort().join(', ')}`);

  if (skipped > 0 && created === 0) {
    console.log(
      '  note: delete old PNGs in server/dev-fixtures/wardrobe/images/ to regenerate placeholders.',
    );
  }
}

void main().catch((error) => {
  console.error('[DEV FIXTURES] Failed:', error);
  process.exit(1);
});
