import type cors from 'cors';

function parseAdminWebOrigins(): string[] {
  const raw = process.env.ADMIN_WEB_ORIGIN?.trim();

  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function createCorsOptions(): cors.CorsOptions {
  const adminOrigins = parseAdminWebOrigins();
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (adminOrigins.length === 0) {
        callback(null, true);
        return;
      }

      if (adminOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (isProduction) {
        callback(new Error('Not allowed by CORS'));
        return;
      }

      callback(null, true);
    },
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  };
}
