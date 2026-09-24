import {
  logBackgroundRemovalError,
  logBackgroundRemovalStarted,
  logBackgroundRemovalSuccess,
} from '../photo-processing/photo-processing-error';
import { BackgroundRemovalError } from './background-removal-error';

const REMOVE_BG_ENDPOINT = 'https://api.remove.bg/v1.0/removebg';

export async function removeBackgroundWithRemoveBg(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<Buffer> {
  const provider = 'removebg' as const;
  const apiKey = process.env.REMOVE_BG_API_KEY;

  if (!apiKey) {
    throw new BackgroundRemovalError(
      'REMOVE_BG_API_KEY is not configured on the server.',
      500,
      provider,
    );
  }

  logBackgroundRemovalStarted(provider);
  const startedAt = Date.now();

  const formData = new FormData();
  const imageBlob = new Blob([new Uint8Array(imageBuffer)], {
    type: mimeType || 'image/jpeg',
  });

  formData.append('image_file', imageBlob, 'clothing.jpg');
  formData.append('size', 'auto');
  formData.append('type', 'product');

  let response: Response;

  try {
    response = await fetch(REMOVE_BG_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logBackgroundRemovalError(provider, message);

    throw new BackgroundRemovalError('Failed to reach background removal service.', 502, provider);
  }

  if (response.ok) {
    const arrayBuffer = await response.arrayBuffer();
    logBackgroundRemovalSuccess(provider, Date.now() - startedAt);

    return Buffer.from(arrayBuffer);
  }

  const errorBody = await response.text();

  if (process.env.NODE_ENV !== 'production') {
    console.error('[BACKGROUND REMOVAL] provider=removebg technical error:', response.status, errorBody);
  }

  if (response.status === 402) {
    logBackgroundRemovalError(provider, 'insufficient credits');

    throw new BackgroundRemovalError('Background removal credits are insufficient.', 402, provider);
  }

  if (response.status === 429) {
    logBackgroundRemovalError(provider, 'rate limit exceeded');

    throw new BackgroundRemovalError('Background removal rate limit exceeded.', 429, provider);
  }

  logBackgroundRemovalError(provider, `status ${response.status}`);

  throw new BackgroundRemovalError('Background removal service returned an error.', response.status, provider);
}
