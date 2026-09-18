# wardrobe-ai-server

Backend API for Wardrobe AI.

## Node.js

The monorepo uses **Node 24** at the root (`.nvmrc`) for the Expo frontend. The backend must run on **Node 22 LTS** (`server/.nvmrc`) because native `better-sqlite3` crashes on Node 24+.

`npm run dev` and `npm run start` automatically switch to Node 22 via nvm. If you bypass those wrappers, run `nvm use` first:

```bash
cd server
npm run dev
```
