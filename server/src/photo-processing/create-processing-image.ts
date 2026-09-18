import sharp from 'sharp';

import { logPhotoImageSizes } from './photo-processing-error';
import type { PreparedUploadedImage } from './prepare-uploaded-image';

export const PROCESSING_MAX_LONG_EDGE = 1600;

export type ProcessingImage = {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
};

export async function createProcessingImage(
  prepared: PreparedUploadedImage,
  maxLongEdge: number = PROCESSING_MAX_LONG_EDGE,
): Promise<ProcessingImage> {
  const longEdge = Math.max(prepared.width, prepared.height);

  if (longEdge <= maxLongEdge) {
    logPhotoImageSizes(
      { width: prepared.width, height: prepared.height },
      { width: prepared.width, height: prepared.height },
    );

    return {
      buffer: prepared.buffer,
      mimeType: prepared.mimeType,
      width: prepared.width,
      height: prepared.height,
    };
  }

  const { data, info } = await sharp(prepared.buffer, { failOn: 'none' })
    .resize({
      width: maxLongEdge,
      height: maxLongEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 92 })
    .toBuffer({ resolveWithObject: true });

  logPhotoImageSizes(
    { width: prepared.width, height: prepared.height },
    { width: info.width, height: info.height },
  );

  return {
    buffer: data,
    mimeType: 'image/jpeg',
    width: info.width,
    height: info.height,
  };
}
