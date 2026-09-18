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

export async function getFamilyWardrobeItemImageDirectory(
  memberPublicId: string,
  itemId: string,
  kind: 'original' | 'processed',
): Promise<Directory> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${memberPublicId}:${itemId}:${kind}`,
  );
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

export async function buildFamilyWardrobeImageMetaFile(
  memberPublicId: string,
  itemId: string,
  kind: 'original' | 'processed',
): Promise<File> {
  const directory = await getFamilyWardrobeItemImageDirectory(memberPublicId, itemId, kind);

  return new File(directory, 'meta.json');
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
