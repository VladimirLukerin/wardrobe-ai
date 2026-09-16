import fs from 'fs/promises';
import path from 'path';

import type { ImageStorage, StoredImage } from './image-storage';
import { sanitizeStorageKey } from './storage-key';

const DEFAULT_IMAGE_STORAGE_DIR = path.join(__dirname, '../../data/wardrobe-images');

function resolveStorageRoot(): string {
  const configured = process.env.IMAGE_STORAGE_DIR?.trim();

  if (!configured) {
    return DEFAULT_IMAGE_STORAGE_DIR;
  }

  return path.isAbsolute(configured)
    ? configured
    : path.join(__dirname, '../../', configured);
}

function resolveAbsoluteKey(key: string, rootDir: string): string | null {
  const sanitizedKey = sanitizeStorageKey(key);

  if (!sanitizedKey) {
    return null;
  }

  const absolutePath = path.resolve(rootDir, sanitizedKey);
  const relative = path.relative(rootDir, absolutePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return absolutePath;
}

export class LocalImageStorage implements ImageStorage {
  private readonly rootDir: string;

  constructor(rootDir: string = resolveStorageRoot()) {
    this.rootDir = rootDir;
  }

  private async ensureRootDir(): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<StoredImage> {
    await this.ensureRootDir();

    const absolutePath = resolveAbsoluteKey(key, this.rootDir);

    if (!absolutePath) {
      throw new Error('Invalid storage key.');
    }

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, data);

    return {
      key,
      contentType,
      size: data.byteLength,
    };
  }

  async get(key: string): Promise<Buffer> {
    const absolutePath = resolveAbsoluteKey(key, this.rootDir);

    if (!absolutePath) {
      throw new Error('Invalid storage key.');
    }

    return fs.readFile(absolutePath);
  }

  async exists(key: string): Promise<boolean> {
    const absolutePath = resolveAbsoluteKey(key, this.rootDir);

    if (!absolutePath) {
      return false;
    }

    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const absolutePath = resolveAbsoluteKey(key, this.rootDir);

    if (!absolutePath) {
      return;
    }

    try {
      await fs.unlink(absolutePath);
    } catch {
      // Ignore missing files during cleanup.
    }
  }
}

let imageStorage: ImageStorage | null = null;

export function getImageStorage(): ImageStorage {
  if (imageStorage) {
    return imageStorage;
  }

  const driver = process.env.IMAGE_STORAGE_DRIVER?.trim() || 'local';

  if (driver !== 'local') {
    throw new Error(`Unsupported IMAGE_STORAGE_DRIVER: ${driver}`);
  }

  imageStorage = new LocalImageStorage();
  return imageStorage;
}
