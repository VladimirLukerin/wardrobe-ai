import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const WARDROBE_ROOT = 'wardrobe';

export async function buildWardrobeLocalStorageHash(
  userId: string | null,
  itemId: string,
): Promise<string> {
  const input = userId ? `${userId}:${itemId}` : itemId;

  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

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

export async function getWardrobeItemImageDirectory(
  userId: string | null,
  itemId: string,
): Promise<Directory> {
  const hash = await buildWardrobeLocalStorageHash(userId, itemId);
  const directory = new Directory(Paths.document, WARDROBE_ROOT, hash);

  directory.create({ idempotent: true, intermediates: true });

  return directory;
}

export async function buildWardrobeLocalOriginalFile(
  userId: string | null,
  itemId: string,
  contentType: string,
): Promise<File> {
  const directory = await getWardrobeItemImageDirectory(userId, itemId);
  const extension = extensionForContentType(contentType);

  return new File(directory, `original${extension}`);
}

export async function buildWardrobeLocalProcessedFile(
  userId: string | null,
  itemId: string,
): Promise<File> {
  const directory = await getWardrobeItemImageDirectory(userId, itemId);

  return new File(directory, 'processed.png');
}

export function localImageFileExists(uri: string | undefined): boolean {
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

export async function buildLocalImageFingerprint(uri: string): string | null {
  try {
    const file = new File(uri);

    if (!file.exists || file.size <= 0) {
      return null;
    }

    const modificationTime =
      'modificationTime' in file && typeof file.modificationTime === 'number'
        ? file.modificationTime
        : 0;

    return `${file.uri}|${file.size}|${modificationTime}`;
  } catch {
    return null;
  }
}

export async function clearAllWardrobeLocalImageFiles(): Promise<void> {
  const root = new Directory(Paths.document, WARDROBE_ROOT);

  if (root.exists) {
    root.delete();
  }
}
