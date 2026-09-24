# PRIKIN Admin Web Panel

Read-only operational admin UI for Wardrobe AI / «ПРИКИНЬ».

## Purpose

- Sign in with separate admin credentials
- Inspect aggregate metrics
- Browse users and read-only subresources (wardrobe, outfits, wear history, family)

No mutating actions are available in this phase.

## Setup

```bash
cd admin
npm install
cp .env.example .env
```

Configure:

- `VITE_ADMIN_API_URL` — backend base URL, e.g. `http://localhost:3000`

On the server, set:

- `ADMIN_WEB_ORIGIN=http://localhost:5173` (see `server/.env.example`)

Create the first admin user on the backend:

```bash
cd ../server
nvm use 22
ADMIN_EMAIL=admin@local.test ADMIN_PASSWORD='LocalAdmin123!' npm run admin:create
```

## Local development

Terminal 1:

```bash
cd server
npm run dev
```

Terminal 2:

```bash
cd admin
npm run dev
```

Open `http://localhost:5173` and sign in.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm test`

## Screens

- `/login`
- `/` dashboard metrics
- `/users` searchable user list
- `/users/:id` read-only detail tabs
- `/ai`, `/settings` placeholders ("скоро")

## Security notes

- Admin bearer token is stored in `sessionStorage` only for the browser tab session.
- Passwords and session tokens are never logged or rendered.
- The panel relies on backend RBAC and audit logging.

## Limitations

- Read-only only
- No image CDN integration (wardrobe shows metadata placeholders)
- AI usage and settings pages are placeholders until backend endpoints exist
