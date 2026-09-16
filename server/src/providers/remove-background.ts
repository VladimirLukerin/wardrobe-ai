const REMOVE_BG_ENDPOINT = 'https://api.remove.bg/v1.0/removebg';

export class RemoveBackgroundError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'RemoveBackgroundError';
    this.statusCode = statusCode;
  }
}

export async function removeClothingBackground(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<Buffer> {
  const apiKey = process.env.REMOVE_BG_API_KEY;

  if (!apiKey) {
    throw new RemoveBackgroundError('REMOVE_BG_API_KEY is not configured on the server.', 500);
  }

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
    console.error('remove.bg network error:', error);
    throw new RemoveBackgroundError('Failed to reach background removal service.', 502);
  }

  if (response.ok) {
    const arrayBuffer = await response.arrayBuffer();

    return Buffer.from(arrayBuffer);
  }

  const errorBody = await response.text();
  console.error('remove.bg API error:', response.status, errorBody);

  if (response.status === 402) {
    throw new RemoveBackgroundError('Background removal credits are insufficient.', 402);
  }

  if (response.status === 429) {
    throw new RemoveBackgroundError('Background removal rate limit exceeded.', 429);
  }

  throw new RemoveBackgroundError('Background removal service returned an error.', response.status);
}
