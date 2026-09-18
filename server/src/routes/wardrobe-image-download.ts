import type { Response } from 'express';

import { getWardrobeImageRecord } from '../db/wardrobe-item-images-repository';
import { getImageStorage } from '../storage/local-image-storage';

const PROCESSED_MIME_TYPE = 'image/png';

export function shortWardrobeItemId(itemId: string): string {
  const dashIndex = itemId.indexOf('-');

  if (dashIndex > 0) {
    return itemId.slice(0, dashIndex);
  }

  return itemId.slice(0, 12);
}

function sendImageNotFound(res: Response): void {
  res.status(404).json({ error: 'Image not found.' });
}

type DownloadLogTag = 'IMAGE SERVER' | 'FAMILY IMAGE';

function logImageDownload({
  tag,
  itemId,
  kind,
  status,
  bytes,
  memberPublicId,
}: {
  tag: DownloadLogTag;
  itemId: string;
  kind: 'original' | 'processed';
  status: number;
  bytes?: number;
  memberPublicId?: string;
}): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const sizeSuffix = typeof bytes === 'number' ? ` bytes=${bytes}` : '';

  if (tag === 'FAMILY IMAGE' && memberPublicId) {
    console.log(
      `[FAMILY IMAGE] member=${memberPublicId.slice(0, 8)} item=${shortWardrobeItemId(itemId)} type=${kind} status=${status}${sizeSuffix}`,
    );
    return;
  }

  console.log(
    `[${tag}] item=${shortWardrobeItemId(itemId)} type=${kind} status=${status}${sizeSuffix}`,
  );
}

export async function sendWardrobeImageDownload(
  res: Response,
  {
    userId,
    itemId,
    kind,
    logTag = 'IMAGE SERVER',
    memberPublicId,
  }: {
    userId: string;
    itemId: string;
    kind: 'original' | 'processed';
    logTag?: DownloadLogTag;
    memberPublicId?: string;
  },
): Promise<void> {
  const record = getWardrobeImageRecord(userId, itemId, kind);

  if (!record) {
    logImageDownload({ tag: logTag, itemId, kind, status: 404, memberPublicId });
    sendImageNotFound(res);
    return;
  }

  try {
    const storage = getImageStorage();
    const bytes = await storage.get(record.key);

    logImageDownload({
      tag: logTag,
      itemId,
      kind,
      status: 200,
      bytes: bytes.length,
      memberPublicId,
    });

    res.setHeader('Content-Type', record.contentType ?? (kind === 'processed' ? PROCESSED_MIME_TYPE : 'application/octet-stream'));
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(bytes);
  } catch (error) {
    console.error(`Failed to download wardrobe ${kind} image:`, error);
    logImageDownload({ tag: logTag, itemId, kind, status: 404, memberPublicId });
    sendImageNotFound(res);
  }
}
