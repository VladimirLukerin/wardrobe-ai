import 'dotenv/config';

import { getDatabase } from './db/database';
import { createApp } from './app';

const PORT = 3000;
const HOST = '0.0.0.0';

getDatabase();

const app = createApp();

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
