export type ClothingAnalysisResult = {
  name: string;
  category: string;
  color: string;
  style: string;
  confidence?: number;
};

const MOCK_RESULT: ClothingAnalysisResult = {
  name: 'Тёмное худи',
  category: 'Худи',
  color: 'Зелёный',
  style: 'Повседневный',
  confidence: 0.9,
};

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Анализирует фотографию вещи и возвращает распознанные атрибуты.
 *
 * Сейчас — mock-реализация с задержкой 1–2 секунды.
 * Позже замените тело функции на вызов backend API, например:
 *
 *   const formData = new FormData();
 *   formData.append('image', { uri: imageUri, type: 'image/jpeg', name: 'item.jpg' });
 *   const response = await fetch('https://your-backend.example/analyze-clothing', {
 *     method: 'POST',
 *     body: formData,
 *   });
 *   if (!response.ok) throw new Error('Analysis failed');
 *   return response.json();
 */
export async function analyzeClothingImage(imageUri: string): Promise<ClothingAnalysisResult> {
  const mockDelayMs = 1000 + Math.random() * 1000;
  await delay(mockDelayMs);

  if (!imageUri) {
    throw new Error('Image URI is required');
  }

  return { ...MOCK_RESULT };
}
