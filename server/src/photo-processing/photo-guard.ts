import { PhotoProcessingGuardError } from './photo-processing-error';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type UploadedImageFile = {
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export function validateUploadedImage(file: UploadedImageFile): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new PhotoProcessingGuardError(
      'Поддерживаются только JPEG, PNG и WebP.',
      'unsupported-mime',
      400,
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new PhotoProcessingGuardError(
      'Размер файла не должен превышать 10 МБ.',
      'file-too-large',
      400,
    );
  }

  if (file.buffer.length === 0) {
    throw new PhotoProcessingGuardError('Изображение пустое.', 'empty-file', 400);
  }
}
