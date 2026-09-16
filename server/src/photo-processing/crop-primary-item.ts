import sharp from 'sharp';

import type { NormalizedBoundingBox } from './photo-decision';
import {
  logPrimaryCrop,
  logPrimaryCropSizes,
  logPhotoTiming,
} from './photo-processing-error';
import type { ProcessingImage } from './create-processing-image';

export const PRIMARY_ITEM_CROP_PADDING_RATIO = 0.1;

export function shouldCropToPrimaryItem(
  clothingCount: number,
  boundingBox: NormalizedBoundingBox | null,
): boolean {
  if (!boundingBox) {
    return false;
  }

  if (clothingCount > 1) {
    return true;
  }

  return clothingCount === 1;
}

export async function cropProcessingImageToPrimaryItem(
  processing: ProcessingImage,
  boundingBox: NormalizedBoundingBox,
  paddingRatio: number = PRIMARY_ITEM_CROP_PADDING_RATIO,
): Promise<ProcessingImage> {
  const cropStartedAt = Date.now();
  const imageWidth = processing.width;
  const imageHeight = processing.height;

  const boxLeft = boundingBox.x * imageWidth;
  const boxTop = boundingBox.y * imageHeight;
  const boxWidth = boundingBox.width * imageWidth;
  const boxHeight = boundingBox.height * imageHeight;

  const paddingX = Math.round(boxWidth * paddingRatio);
  const paddingY = Math.round(boxHeight * paddingRatio);

  let left = Math.floor(boxLeft - paddingX);
  let top = Math.floor(boxTop - paddingY);
  let right = Math.ceil(boxLeft + boxWidth + paddingX);
  let bottom = Math.ceil(boxTop + boxHeight + paddingY);

  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(imageWidth, right);
  bottom = Math.min(imageHeight, bottom);

  const cropWidth = Math.max(1, right - left);
  const cropHeight = Math.max(1, bottom - top);

  logPrimaryCrop('valid', paddingRatio);
  logPrimaryCropSizes(
    { width: imageWidth, height: imageHeight },
    { width: cropWidth, height: cropHeight },
  );

  const { data, info } = await sharp(processing.buffer, { failOn: 'none' })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .jpeg({ quality: 92 })
    .toBuffer({ resolveWithObject: true });

  logPhotoTiming('primaryCrop', Date.now() - cropStartedAt);

  return {
    buffer: data,
    mimeType: 'image/jpeg',
    width: info.width,
    height: info.height,
  };
}
