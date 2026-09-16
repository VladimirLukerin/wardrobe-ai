import type { Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';

import {
  assertOwnedWardrobeItem,
  getWardrobeImageRecord,
  updateWardrobeOriginalImage,
  updateWardrobeProcessedImage,
} from '../db/wardrobe-item-images-repository';
import { requireAuth } from '../middleware/auth';
import { getImageStorage } from '../storage/local-image-storage';
import {
  buildOriginalImageKey,
  buildProcessedImageKey,
  buildWardrobeStoragePrefix,
  extensionForMimeType,
} from '../storage/storage-key';

const wardrobeImagesRouter = Router({ mergeParams: true });

const ALLOWED_ORIGINAL_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const PROCESSED_MIME_TYPE = 'image/png';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

function getItemIdFromQuery(req: Request): string | null {
  const itemId = req.query.itemId;

  return typeof itemId === 'string' && itemId.trim().length > 0 ? itemId.trim() : null;
}

function getItemId(req: Request): string | null {
  const queryItemId = getItemIdFromQuery(req);

  if (queryItemId) {
    return queryItemId;
  }

  const pathItemId = req.params.itemId;

  return typeof pathItemId === 'string' && pathItemId.trim().length > 0 ? pathItemId.trim() : null;
}

function sendImageNotFound(res: Response): void {
  res.status(404).json({ error: 'Image not found.' });
}

function shortWardrobeItemId(itemId: string): string {
  const dashIndex = itemId.indexOf('-');

  if (dashIndex > 0) {
    return itemId.slice(0, dashIndex);
  }

  return itemId.slice(0, 12);
}

function logImageServerDownload({
  itemId,
  kind,
  status,
  bytes,
}: {
  itemId: string;
  kind: 'original' | 'processed';
  status: number;
  bytes?: number;
}): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const sizeSuffix = typeof bytes === 'number' ? ` bytes=${bytes}` : '';
  console.log(
    `[IMAGE SERVER] item=${shortWardrobeItemId(itemId)} type=${kind} status=${status}${sizeSuffix}`,
  );
}

wardrobeImagesRouter.post(
  '/images/original',
  requireAuth,
  upload.single('image'),
  async (req: Request, res: Response) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const itemId = getItemIdFromQuery(req);

    if (!itemId || !req.file) {
      res.status(400).json({ error: 'Invalid wardrobe image upload.' });
      return;
    }

    const mimeType = req.file.mimetype;

    if (!ALLOWED_ORIGINAL_MIME_TYPES.has(mimeType)) {
      res.status(400).json({ error: 'Unsupported image type.' });
      return;
    }

    const ownedItem = assertOwnedWardrobeItem(req.authUser.id, itemId);

    if (!ownedItem) {
      res.status(404).json({ error: 'Wardrobe item not found.' });
      return;
    }

    try {
      const prefix = buildWardrobeStoragePrefix(req.authUser.id, itemId);
      const storageKey = buildOriginalImageKey(prefix, extensionForMimeType(mimeType));
      const uploadedAt = new Date().toISOString();
      const storage = getImageStorage();

      await storage.put(storageKey, req.file.buffer, mimeType);
      updateWardrobeOriginalImage({
        userId: req.authUser.id,
        itemId,
        storageKey,
        contentType: mimeType,
        uploadedAt,
      });

      console.log('[IMAGE SYNC] upload original');

      res.status(201).json({
        kind: 'original',
        uploadedAt,
        contentType: mimeType,
      });
    } catch (error) {
      console.error('Failed to upload wardrobe original image:', error);
      res.status(500).json({ error: 'Не удалось загрузить изображение.' });
    }
  },
);

wardrobeImagesRouter.post(
  '/:itemId/images/original',
  requireAuth,
  upload.single('image'),
  async (req: Request, res: Response) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const itemId = getItemId(req);

    if (!itemId || !req.file) {
      res.status(400).json({ error: 'Invalid wardrobe image upload.' });
      return;
    }

    const mimeType = req.file.mimetype;

    if (!ALLOWED_ORIGINAL_MIME_TYPES.has(mimeType)) {
      res.status(400).json({ error: 'Unsupported image type.' });
      return;
    }

    const ownedItem = assertOwnedWardrobeItem(req.authUser.id, itemId);

    if (!ownedItem) {
      res.status(404).json({ error: 'Wardrobe item not found.' });
      return;
    }

    try {
      const prefix = buildWardrobeStoragePrefix(req.authUser.id, itemId);
      const storageKey = buildOriginalImageKey(prefix, extensionForMimeType(mimeType));
      const uploadedAt = new Date().toISOString();
      const storage = getImageStorage();

      await storage.put(storageKey, req.file.buffer, mimeType);
      updateWardrobeOriginalImage({
        userId: req.authUser.id,
        itemId,
        storageKey,
        contentType: mimeType,
        uploadedAt,
      });

      console.log('[IMAGE SYNC] upload original');

      res.status(201).json({
        kind: 'original',
        uploadedAt,
        contentType: mimeType,
      });
    } catch (error) {
      console.error('Failed to upload wardrobe original image:', error);
      res.status(500).json({ error: 'Не удалось загрузить изображение.' });
    }
  },
);

wardrobeImagesRouter.post(
  '/images/processed',
  requireAuth,
  upload.single('image'),
  async (req: Request, res: Response) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const itemId = getItemIdFromQuery(req);

    if (!itemId || !req.file) {
      res.status(400).json({ error: 'Invalid wardrobe image upload.' });
      return;
    }

    const mimeType = req.file.mimetype;

    if (mimeType !== PROCESSED_MIME_TYPE) {
      res.status(400).json({ error: 'Processed image must be PNG.' });
      return;
    }

    const ownedItem = assertOwnedWardrobeItem(req.authUser.id, itemId);

    if (!ownedItem) {
      res.status(404).json({ error: 'Wardrobe item not found.' });
      return;
    }

    try {
      const prefix = buildWardrobeStoragePrefix(req.authUser.id, itemId);
      const storageKey = buildProcessedImageKey(prefix);
      const uploadedAt = new Date().toISOString();
      const storage = getImageStorage();

      await storage.put(storageKey, req.file.buffer, PROCESSED_MIME_TYPE);
      updateWardrobeProcessedImage({
        userId: req.authUser.id,
        itemId,
        storageKey,
        contentType: PROCESSED_MIME_TYPE,
        uploadedAt,
      });

      console.log('[IMAGE SYNC] upload processed');

      res.status(201).json({
        kind: 'processed',
        uploadedAt,
        contentType: PROCESSED_MIME_TYPE,
      });
    } catch (error) {
      console.error('Failed to upload wardrobe processed image:', error);
      res.status(500).json({ error: 'Не удалось загрузить изображение.' });
    }
  },
);

wardrobeImagesRouter.post(
  '/:itemId/images/processed',
  requireAuth,
  upload.single('image'),
  async (req: Request, res: Response) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const itemId = getItemId(req);

    if (!itemId || !req.file) {
      res.status(400).json({ error: 'Invalid wardrobe image upload.' });
      return;
    }

    const mimeType = req.file.mimetype;

    if (mimeType !== PROCESSED_MIME_TYPE) {
      res.status(400).json({ error: 'Processed image must be PNG.' });
      return;
    }

    const ownedItem = assertOwnedWardrobeItem(req.authUser.id, itemId);

    if (!ownedItem) {
      res.status(404).json({ error: 'Wardrobe item not found.' });
      return;
    }

    try {
      const prefix = buildWardrobeStoragePrefix(req.authUser.id, itemId);
      const storageKey = buildProcessedImageKey(prefix);
      const uploadedAt = new Date().toISOString();
      const storage = getImageStorage();

      await storage.put(storageKey, req.file.buffer, PROCESSED_MIME_TYPE);
      updateWardrobeProcessedImage({
        userId: req.authUser.id,
        itemId,
        storageKey,
        contentType: PROCESSED_MIME_TYPE,
        uploadedAt,
      });

      console.log('[IMAGE SYNC] upload processed');

      res.status(201).json({
        kind: 'processed',
        uploadedAt,
        contentType: PROCESSED_MIME_TYPE,
      });
    } catch (error) {
      console.error('Failed to upload wardrobe processed image:', error);
      res.status(500).json({ error: 'Не удалось загрузить изображение.' });
    }
  },
);

wardrobeImagesRouter.get('/images/original', requireAuth, async (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const itemId = getItemIdFromQuery(req);

  if (!itemId) {
    logImageServerDownload({ itemId: 'unknown', kind: 'original', status: 404 });
    sendImageNotFound(res);
    return;
  }

  const record = getWardrobeImageRecord(req.authUser.id, itemId, 'original');

  if (!record) {
    logImageServerDownload({ itemId, kind: 'original', status: 404 });
    sendImageNotFound(res);
    return;
  }

  try {
    const storage = getImageStorage();
    const bytes = await storage.get(record.key);

    logImageServerDownload({ itemId, kind: 'original', status: 200, bytes: bytes.length });

    res.setHeader('Content-Type', record.contentType ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(bytes);
  } catch (error) {
    console.error('Failed to download wardrobe original image:', error);
    logImageServerDownload({ itemId, kind: 'original', status: 404 });
    sendImageNotFound(res);
  }
});

wardrobeImagesRouter.get('/images/processed', requireAuth, async (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const itemId = getItemIdFromQuery(req);

  if (!itemId) {
    logImageServerDownload({ itemId: 'unknown', kind: 'processed', status: 404 });
    sendImageNotFound(res);
    return;
  }

  const record = getWardrobeImageRecord(req.authUser.id, itemId, 'processed');

  if (!record) {
    logImageServerDownload({ itemId, kind: 'processed', status: 404 });
    sendImageNotFound(res);
    return;
  }

  try {
    const storage = getImageStorage();
    const bytes = await storage.get(record.key);

    logImageServerDownload({ itemId, kind: 'processed', status: 200, bytes: bytes.length });

    res.setHeader('Content-Type', record.contentType ?? PROCESSED_MIME_TYPE);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(bytes);
  } catch (error) {
    console.error('Failed to download wardrobe processed image:', error);
    logImageServerDownload({ itemId, kind: 'processed', status: 404 });
    sendImageNotFound(res);
  }
});

wardrobeImagesRouter.get('/:itemId/images/original', requireAuth, async (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const itemId = getItemId(req);

  if (!itemId) {
    sendImageNotFound(res);
    return;
  }

  const record = getWardrobeImageRecord(req.authUser.id, itemId, 'original');

  if (!record) {
    sendImageNotFound(res);
    return;
  }

  try {
    const storage = getImageStorage();
    const bytes = await storage.get(record.key);

    console.log('[IMAGE SYNC] download original');

    res.setHeader('Content-Type', record.contentType ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(bytes);
  } catch (error) {
    console.error('Failed to download wardrobe original image:', error);
    sendImageNotFound(res);
  }
});

wardrobeImagesRouter.get('/:itemId/images/processed', requireAuth, async (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const itemId = getItemId(req);

  if (!itemId) {
    sendImageNotFound(res);
    return;
  }

  const record = getWardrobeImageRecord(req.authUser.id, itemId, 'processed');

  if (!record) {
    sendImageNotFound(res);
    return;
  }

  try {
    const storage = getImageStorage();
    const bytes = await storage.get(record.key);

    console.log('[IMAGE SYNC] download processed');

    res.setHeader('Content-Type', record.contentType ?? PROCESSED_MIME_TYPE);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(bytes);
  } catch (error) {
    console.error('Failed to download wardrobe processed image:', error);
    sendImageNotFound(res);
  }
});

export { wardrobeImagesRouter };
