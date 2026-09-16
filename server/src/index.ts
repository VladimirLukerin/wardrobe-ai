import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';

import { normalizeProcessedClothingImage } from './normalize-processed-image';
import {
  RemoveBackgroundError,
  removeClothingBackground,
} from './providers/remove-background';
import { currentWeatherHandler } from './current-weather';
import { suggestOutfitsHandler } from './suggest-outfits';

const PORT = 3000;
const HOST = '0.0.0.0';
const MODEL = 'gpt-4o';

const CATEGORIES = [
  'Футболка',
  'Рубашка',
  'Худи',
  'Свитер',
  'Куртка',
  'Брюки',
  'Джинсы',
  'Шорты',
  'Обувь',
  'Аксессуар',
  'Другое',
] as const;

const COLORS = [
  'Чёрный',
  'Белый',
  'Серый',
  'Синий',
  'Голубой',
  'Зелёный',
  'Красный',
  'Бежевый',
  'Коричневый',
  'Жёлтый',
  'Другой',
  'Не определён',
] as const;

const STYLES = [
  'Повседневный',
  'Деловой',
  'Спортивный',
  'Вечерний',
  'Универсальный',
] as const;

const PATTERNS = [
  'Без принта',
  'Принт',
  'Полоска',
  'Клетка',
  'Горошек',
  'Камуфляж',
  'Градиент',
  'Другое',
] as const;

type ClothingAnalysisResult = {
  baseName: string;
  category: (typeof CATEGORIES)[number];
  color: (typeof COLORS)[number];
  pattern: (typeof PATTERNS)[number];
  printDescription: string | null;
  style: (typeof STYLES)[number];
  confidence: number;
};

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/analyze-clothing', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Изображение обязательно. Отправьте файл в поле image.' });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: 'OPENAI_API_KEY не настроен на сервере.' });
      return;
    }

    const openai = new OpenAI({ apiKey });
    const imageBase64 = req.file.buffer.toString('base64');
    const imageDataUrl = `data:${req.file.mimetype};base64,${imageBase64}`;

    const response = await openai.responses.create({
      model: MODEL,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Проанализируй фотографию одежды и определи атрибуты вещи.',
                'baseName — короткое базовое название вещи на русском, например: "Шорты", "Футболка", "Худи".',
                'Не прячь всю информацию только в baseName — pattern и printDescription заполняй отдельно.',
                'category, color, pattern и style выбирай строго из допустимых значений.',
                'printDescription — короткое описание принта на русском, если принт различим.',
                'Если принта нет или он неразличим, pattern = "Без принта" и printDescription = null.',
                'Не выдумывай printDescription, если не уверен.',
                'confidence — число от 0 до 1, отражающее уверенность в распознавании.',
              ].join(' '),
            },
            {
              type: 'input_image',
              image_url: imageDataUrl,
              detail: 'auto',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'clothing_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              baseName: { type: 'string' },
              category: { type: 'string', enum: [...CATEGORIES] },
              color: { type: 'string', enum: [...COLORS] },
              pattern: { type: 'string', enum: [...PATTERNS] },
              printDescription: { type: ['string', 'null'] },
              style: { type: 'string', enum: [...STYLES] },
              confidence: { type: 'number' },
            },
            required: [
              'baseName',
              'category',
              'color',
              'pattern',
              'printDescription',
              'style',
              'confidence',
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const outputText = response.output_text;

    if (!outputText) {
      res.status(502).json({ error: 'OpenAI не вернул результат анализа.' });
      return;
    }

    const result = JSON.parse(outputText) as ClothingAnalysisResult;
    res.json(result);
  } catch (error) {
    console.error('Failed to analyze clothing image:', error);
    res.status(500).json({ error: 'Не удалось проанализировать изображение.' });
  }
});

app.post('/suggest-outfits', suggestOutfitsHandler);
app.post('/current-weather', currentWeatherHandler);

app.post('/process-clothing-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Изображение обязательно. Отправьте файл в поле image.' });
      return;
    }

    const removedBackground = await removeClothingBackground(req.file.buffer, req.file.mimetype);

    let processedImage: Buffer;

    try {
      processedImage = await normalizeProcessedClothingImage(removedBackground);
    } catch (normalizeError) {
      console.error('Failed to normalize processed image, using remove.bg output:', normalizeError);
      processedImage = removedBackground;
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(processedImage);
  } catch (error) {
    if (error instanceof RemoveBackgroundError) {
      if (error.statusCode === 500 && error.message.includes('REMOVE_BG_API_KEY')) {
        res.status(500).json({ error: 'REMOVE_BG_API_KEY не настроен на сервере.' });
        return;
      }

      if (error.statusCode === 402) {
        res.status(402).json({ error: 'Недостаточно credits для удаления фона.' });
        return;
      }

      if (error.statusCode === 429) {
        res.status(429).json({ error: 'Превышен лимит запросов к сервису удаления фона.' });
        return;
      }

      if (error.statusCode === 502) {
        res.status(502).json({ error: 'Не удалось связаться с сервисом удаления фона.' });
        return;
      }

      res.status(502).json({ error: 'Не удалось обработать изображение.' });
      return;
    }

    console.error('Failed to process clothing image:', error);
    res.status(500).json({ error: 'Не удалось обработать изображение.' });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
