import type { Request, Response } from 'express';

import { enforceAiRateLimit } from '../ai-request-rate-limit';
import { normalizeProcessedClothingImage } from '../normalize-processed-image';
import {
  BackgroundRemovalError,
  removeClothingBackground,
} from '../providers/background-removal';
import { validateUploadedImage } from './photo-guard';
import {
  PhotoProcessingGuardError,
  logBackgroundRemovalSkipped,
  logPhotoTiming,
  logPhotoTimingTotal,
  logPhotoAiRequest,
  PHOTO_VISION_DETAIL,
  logPrimaryCrop,
  logPrimaryCropSizes,
} from './photo-processing-error';
import { createProcessingImage } from './create-processing-image';
import { createAnalysisImage } from './create-analysis-image';
import {
  cropProcessingImageToPrimaryItem,
  PRIMARY_ITEM_CROP_PADDING_RATIO,
  shouldCropToPrimaryItem,
} from './crop-primary-item';
import { getPhotoRejectMessage, isPhotoRejectReason } from './photo-decision';
import { prepareUploadedImage, type PreparedUploadedImage } from './prepare-uploaded-image';
import { validateAndRecognizeClothingPhoto } from './photo-validation-recognition';
import { createImageFingerprint, runCachedImageProcessing, type PhotoProcessingResult } from './processing-cost-guard';

const BACKGROUND_REMOVAL_USER_MESSAGE = 'Не удалось обработать фон';

class PhotoProcessingRateLimitedError extends Error {
  constructor() {
    super('photo_rate_limited');
    this.name = 'PhotoProcessingRateLimitedError';
  }
}

async function runProcessingPipeline(prepared: PreparedUploadedImage): Promise<PhotoProcessingResult> {
  const totalStartedAt = Date.now();

  const analysisResizeStartedAt = Date.now();
  const analysis = await createAnalysisImage(prepared);
  logPhotoTiming('analysisResize', Date.now() - analysisResizeStartedAt);

  logPhotoAiRequest({
    cache: 'miss',
    analysisWidth: analysis.width,
    analysisHeight: analysis.height,
    analysisBytes: analysis.buffer.byteLength,
    detail: PHOTO_VISION_DETAIL,
  });

  const openAiStartedAt = Date.now();
  const recognition = await validateAndRecognizeClothingPhoto(analysis.buffer, analysis.mimeType);
  logPhotoTiming('openai', Date.now() - openAiStartedAt);

  if (!recognition.accepted || !recognition.item || recognition.rejectReason) {
    logBackgroundRemovalSkipped();
    logPhotoTimingTotal(Date.now() - totalStartedAt);

    const rejectReason = isPhotoRejectReason(recognition.rejectReason)
      ? recognition.rejectReason
      : 'item_not_clear';

    return {
      accepted: false as const,
      rejectReason,
      rejectMessage: recognition.rejectMessage ?? getPhotoRejectMessage(rejectReason),
      confidence: recognition.confidence,
      item: null,
    };
  }

  const processingResizeStartedAt = Date.now();
  const processing = await createProcessingImage(prepared);
  logPhotoTiming('processingResize', Date.now() - processingResizeStartedAt);

  let processingForBackground = processing;

  if (shouldCropToPrimaryItem(recognition.clothingCount, recognition.boundingBox)) {
    processingForBackground = await cropProcessingImageToPrimaryItem(
      processing,
      recognition.boundingBox!,
    );
  } else {
    logPrimaryCrop('invalid', PRIMARY_ITEM_CROP_PADDING_RATIO);
    logPrimaryCropSizes(
      { width: processing.width, height: processing.height },
      { width: processing.width, height: processing.height },
    );
  }

  const backgroundRemovalStartedAt = Date.now();
  const removedBackground = await removeClothingBackground(
    processingForBackground.buffer,
    processingForBackground.mimeType,
  );
  logPhotoTiming('backgroundRemoval', Date.now() - backgroundRemovalStartedAt);

  let processedImage: Buffer;

  const normalizeStartedAt = Date.now();

  try {
    processedImage = await normalizeProcessedClothingImage(removedBackground);
  } catch (normalizeError) {
    console.error('Failed to normalize processed image, using raw background removal output:', normalizeError);
    processedImage = removedBackground;
  }

  logPhotoTiming('normalize', Date.now() - normalizeStartedAt);
  logPhotoTimingTotal(Date.now() - totalStartedAt);

  return {
    accepted: true as const,
    rejectReason: null,
    confidence: recognition.confidence,
    item: recognition.item,
    processedImage,
  };
}

export async function handleProcessClothingImage(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Изображение обязательно. Отправьте файл в поле image.' });
      return;
    }

    validateUploadedImage(req.file);

    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const prepareStartedAt = Date.now();
    const prepared = await prepareUploadedImage(req.file.buffer, req.file.mimetype);
    logPhotoTiming('prepare', Date.now() - prepareStartedAt);

    const fingerprint = createImageFingerprint(prepared.buffer);
    const result = await runCachedImageProcessing(fingerprint, async () => {
      if (!enforceAiRateLimit(res, req.authUser!.id, 'photo')) {
        throw new PhotoProcessingRateLimitedError();
      }

      return runProcessingPipeline(prepared);
    }, {
      onCacheHit: () => {
        logPhotoAiRequest({
          cache: 'hit',
          analysisWidth: prepared.width,
          analysisHeight: prepared.height,
          analysisBytes: 0,
          detail: PHOTO_VISION_DETAIL,
        });
      },
    });

    if (!result.accepted) {
      res.status(200).json({
        accepted: false,
        rejectReason: result.rejectReason,
        rejectMessage: result.rejectMessage,
        confidence: result.confidence,
        item: null,
      });
      return;
    }

    res.status(200).json({
      accepted: true,
      rejectReason: null,
      confidence: result.confidence,
      item: result.item,
      processedImageBase64: result.processedImage.toString('base64'),
    });
  } catch (error) {
    if (error instanceof PhotoProcessingRateLimitedError) {
      return;
    }

    if (error instanceof PhotoProcessingGuardError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    if (error instanceof BackgroundRemovalError) {
      res.status(502).json({
        error: BACKGROUND_REMOVAL_USER_MESSAGE,
        code: 'background_removal',
      });
      return;
    }

    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      res.status(500).json({ error: 'OPENAI_API_KEY не настроен на сервере.' });
      return;
    }

    console.error('Failed to process clothing image:', error);
    res.status(500).json({ error: 'Не удалось обработать изображение.' });
  }
}
