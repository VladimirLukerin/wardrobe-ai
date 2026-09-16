import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

import {
  wardrobeOriginalImageDownloadEndpoint,
  wardrobeOriginalImageUploadEndpoint,
  wardrobeProcessedImageDownloadEndpoint,
  wardrobeProcessedImageUploadEndpoint,
} from '@/config/api';
import { AccountApiError } from '@/services/account';
import { NETWORK_ERROR_MESSAGE, isNetworkFailure, warnNetworkFailure } from '@/utils/network-error';

export type WardrobeImageUploadResponse = {
  kind: 'original' | 'processed';
  uploadedAt: string;
  contentType: string;
};

export type WardrobeImageDownloadResult = {
  bytes: Uint8Array;
  contentType: string;
};

async function parseUploadResponse(response: Response): Promise<WardrobeImageUploadResponse> {
  const payload = (await response.json().catch(() => null)) as
    | WardrobeImageUploadResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;

    throw new AccountApiError(response.status, message);
  }

  return payload as WardrobeImageUploadResponse;
}

async function uploadWardrobeImage({
  token,
  itemId,
  imageUri,
  endpoint,
}: {
  token: string;
  itemId: string;
  imageUri: string;
  endpoint: string;
}): Promise<WardrobeImageUploadResponse> {
  const sourceFile = new File(imageUri);
  const formData = new FormData();

  formData.append('image', sourceFile);

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('IMAGE CLIENT', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  return parseUploadResponse(response);
}

export async function uploadWardrobeOriginalImage(
  token: string,
  itemId: string,
  imageUri: string,
): Promise<WardrobeImageUploadResponse> {
  return uploadWardrobeImage({
    token,
    itemId,
    imageUri,
    endpoint: wardrobeOriginalImageUploadEndpoint(itemId),
  });
}

export async function uploadWardrobeProcessedImage(
  token: string,
  itemId: string,
  imageUri: string,
): Promise<WardrobeImageUploadResponse> {
  return uploadWardrobeImage({
    token,
    itemId,
    imageUri,
    endpoint: wardrobeProcessedImageUploadEndpoint(itemId),
  });
}

async function downloadWardrobeImage(
  token: string,
  endpoint: string,
): Promise<WardrobeImageDownloadResult> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (__DEV__) {
      console.log('[IMAGE CLIENT] HTTP status=network-error');
    }

    if (isNetworkFailure(error)) {
      warnNetworkFailure('IMAGE CLIENT', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  if (__DEV__) {
    console.log(`[IMAGE CLIENT] HTTP status=${response.status}`);
  }

  if (!response.ok) {
    throw new AccountApiError(response.status, `Request failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const bytes = await response.bytes();

  if (__DEV__) {
    console.log(`[IMAGE CLIENT] bytes=${bytes.byteLength}`);
  }

  if (bytes.byteLength === 0) {
    throw new AccountApiError(500, 'Empty image response');
  }

  return {
    bytes,
    contentType,
  };
}

export async function downloadWardrobeOriginalImage(
  token: string,
  itemId: string,
): Promise<WardrobeImageDownloadResult> {
  return downloadWardrobeImage(token, wardrobeOriginalImageDownloadEndpoint(itemId));
}

export async function downloadWardrobeProcessedImage(
  token: string,
  itemId: string,
): Promise<WardrobeImageDownloadResult> {
  return downloadWardrobeImage(token, wardrobeProcessedImageDownloadEndpoint(itemId));
}
