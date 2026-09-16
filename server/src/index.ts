import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import multer from 'multer';

import { getDatabase } from './db/database';
import { currentWeatherHandler } from './current-weather';
import { requireAuth } from './middleware/auth';
import { handleProcessClothingImage } from './photo-processing/process-clothing-image';
import { authRouter, meHandler } from './routes/auth';
import { emailLoginRouter } from './routes/email-login';
import { emailLinkRouter } from './routes/email-link';
import { familyRouter } from './routes/family';
import { phoneLoginRouter } from './routes/phone-login';
import { phoneLinkRouter } from './routes/phone-link';
import { outfitsRouter } from './routes/outfits';
import { wearHistoryRouter } from './routes/wear-history';
import { preferencesRouter } from './routes/preferences';
import { wardrobeImagesRouter } from './routes/wardrobe-images';
import { wardrobeRouter } from './routes/wardrobe';
import { suggestOutfitsHandler } from './suggest-outfits';

const PORT = 3000;
const HOST = '0.0.0.0';

getDatabase();

const app = express();

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const startedAt = Date.now();

    res.on('finish', () => {
      console.log(
        `[${req.method}] ${req.path} -> ${res.statusCode} ${Date.now() - startedAt}ms`,
      );
    });

    next();
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/auth', emailLoginRouter);
app.use('/auth', phoneLoginRouter);
app.use('/me', preferencesRouter);
app.use('/me', emailLinkRouter);
app.use('/me', phoneLinkRouter);
app.use('/me', outfitsRouter);
app.use('/me', wearHistoryRouter);
app.use('/me', familyRouter);
app.use('/me', wardrobeRouter);
app.use('/me/wardrobe', wardrobeImagesRouter);
app.get('/me', requireAuth, meHandler);

app.post('/suggest-outfits', suggestOutfitsHandler);
app.post('/current-weather', currentWeatherHandler);

app.post('/process-clothing-image', requireAuth, upload.single('image'), (req, res) => {
  void handleProcessClothingImage(req, res);
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
