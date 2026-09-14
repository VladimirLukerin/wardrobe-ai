import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';

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

type ClothingAnalysisResult = {
  name: string;
  category: (typeof CATEGORIES)[number];
  color: (typeof COLORS)[number];
  style: (typeof STYLES)[number];
  confidence: number;
};

const app = express();

app.use(cors());
app.use(express.json());

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
                'Название должно быть коротким и на русском языке.',
                'category, color и style выбирай строго из допустимых значений.',
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
              name: { type: 'string' },
              category: { type: 'string', enum: [...CATEGORIES] },
              color: { type: 'string', enum: [...COLORS] },
              style: { type: 'string', enum: [...STYLES] },
              confidence: { type: 'number' },
            },
            required: ['name', 'category', 'color', 'style', 'confidence'],
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

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
