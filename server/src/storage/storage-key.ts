import crypto from 'crypto';

export function buildWardrobeStoragePrefix(userId: string, itemId: string): string {
  return crypto.createHash('sha256').update(`${userId}:${itemId}`).digest('hex');
}

export function buildOriginalImageKey(prefix: string, extension: string): string {
  const safeExtension = extension.startsWith('.') ? extension : `.${extension}`;

  return `${prefix}/original${safeExtension}`;
}

export function buildProcessedImageKey(prefix: string): string {
  return `${prefix}/processed.png`;
}

export function sanitizeStorageKey(key: string): string | null {
  if (!key || key.includes('..') || key.includes('\\') || key.startsWith('/')) {
    return null;
  }

  const segments = key.split('/');

  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    return null;
  }

  return key;
}

export function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
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
