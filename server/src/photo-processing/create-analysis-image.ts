import sharp from 'sharp';

import { logPhotoAnalysisSizes } from './photo-processing-error';
import type { PreparedUploadedImage } from './prepare-uploaded-image';

export const ANALYSIS_MAX_LONG_EDGE = 1280;

export type AnalysisImage = {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
};

export async function createAnalysisImage(
  prepared: PreparedUploadedImage,
  maxLongEdge: number = ANALYSIS_MAX_LONG_EDGE,
): Promise<AnalysisImage> {
  const longEdge = Math.max(prepared.width, prepared.height);

  if (longEdge <= maxLongEdge) {
    logPhotoAnalysisSizes(
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
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });

  logPhotoAnalysisSizes(
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
