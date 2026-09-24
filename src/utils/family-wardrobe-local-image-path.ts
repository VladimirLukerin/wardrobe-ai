import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const FAMILY_WARDROBE_ROOT = 'family-wardrobe';

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/heic':
      return '.heic';
    case 'image/heif':
      return '.heif';
    default:
      return '.bin';
  }
}

export async function buildFamilyMemberStorageHash(memberPublicId: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, memberPublicId);
}

async function buildLegacyFamilyWardrobeItemStorageHash(
  memberPublicId: string,
  itemId: string,
  kind: 'original' | 'processed',
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${memberPublicId}:${itemId}:${kind}`,
  );
}

async function buildFamilyWardrobeItemStorageHash(
  itemId: string,
  kind: 'original' | 'processed',
): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${itemId}:${kind}`);
}

export async function getFamilyMemberImageRootDirectory(
  memberPublicId: string,
): Promise<Directory> {
  const memberHash = await buildFamilyMemberStorageHash(memberPublicId);
  const directory = new Directory(Paths.document, FAMILY_WARDROBE_ROOT, memberHash);

  directory.create({ idempotent: true, intermediates: true });

  return directory;
}

export async function getFamilyWardrobeItemImageDirectory(
  memberPublicId: string,
  itemId: string,
  kind: 'original' | 'processed',
): Promise<Directory> {
  const memberDirectory = await getFamilyMemberImageRootDirectory(memberPublicId);
  const itemHash = await buildFamilyWardrobeItemStorageHash(itemId, kind);
  const directory = new Directory(memberDirectory, itemHash);

  directory.create({ idempotent: true, intermediates: true });

  return directory;
}

export async function getLegacyFamilyWardrobeItemImageDirectory(
  memberPublicId: string,
  itemId: string,
  kind: 'original' | 'processed',
): Promise<Directory> {
  const hash = await buildLegacyFamilyWardrobeItemStorageHash(memberPublicId, itemId, kind);
  const directory = new Directory(Paths.document, FAMILY_WARDROBE_ROOT, hash);

  directory.create({ idempotent: true, intermediates: true });

  return directory;
}

export async function buildFamilyWardrobeCachedImageFile(
  memberPublicId: string,
  itemId: string,
  kind: 'original' | 'processed',
  contentType: string,
): Promise<File> {
  const directory = await getFamilyWardrobeItemImageDirectory(memberPublicId, itemId, kind);
  const filename = kind === 'processed' ? 'processed.png' : `original${extensionForContentType(contentType)}`;

  return new File(directory, filename);
}

export async function buildLegacyFamilyWardrobeCachedImageFile(
  memberPublicId: string,
  itemId: string,
  kind: 'original' | 'processed',
  contentType: string,
): Promise<File> {
  const directory = await getLegacyFamilyWardrobeItemImageDirectory(memberPublicId, itemId, kind);
  const filename = kind === 'processed' ? 'processed.png' : `original${extensionForContentType(contentType)}`;

  return new File(directory, filename);
}

export async function buildFamilyWardrobeImageMetaFile(
  memberPublicId: string,
  itemId: string,
  kind: 'original' | 'processed',
): Promise<File> {
  const directory = await getFamilyWardrobeItemImageDirectory(memberPublicId, itemId, kind);

  return new File(directory, 'meta.json');
}

export async function buildLegacyFamilyWardrobeImageMetaFile(
  memberPublicId: string,
  itemId: string,
  kind: 'original' | 'processed',
): Promise<File> {
  const directory = await getLegacyFamilyWardrobeItemImageDirectory(memberPublicId, itemId, kind);

  return new File(directory, 'meta.json');
}

export async function clearAllFamilyWardrobeLocalImageFiles(): Promise<void> {
  const root = new Directory(Paths.document, FAMILY_WARDROBE_ROOT);

  if (root.exists) {
    root.delete();
  }
}

export async function clearFamilyMemberWardrobeLocalImageFiles(
  memberPublicId: string,
  knownItemIds: string[] = [],
): Promise<void> {
  const memberRoot = await getFamilyMemberImageRootDirectory(memberPublicId);

  if (memberRoot.exists) {
    memberRoot.delete();
  }

  const uniqueItemIds = [...new Set(knownItemIds.filter((itemId) => itemId.length > 0))];

  for (const itemId of uniqueItemIds) {
    for (const kind of ['original', 'processed'] as const) {
      try {
        const legacyDirectory = await getLegacyFamilyWardrobeItemImageDirectory(
          memberPublicId,
          itemId,
          kind,
        );

        if (legacyDirectory.exists) {
          legacyDirectory.delete();
        }
      } catch {
        // Best-effort legacy cleanup only for known item ids.
      }
    }
  }
}

export function localFamilyImageFileExists(uri: string | undefined): boolean {
  if (!uri) {
    return false;
  }

  try {
    const file = new File(uri);

    return file.exists && file.size > 0;
  } catch {
    return false;
  }
}
