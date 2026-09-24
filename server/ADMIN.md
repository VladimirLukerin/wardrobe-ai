# Wardrobe AI Admin API (MVP)

Backend admin API for operational support, plus a separate read-only web panel in `admin/`.

## Purpose

- Separate admin authentication from normal user sessions
- Role-based access control (`owner`, `admin`, `viewer`)
- Audit trail for admin actions
- Read-only user inspection APIs

## Create the first admin

From `server/` with Node 22:

```bash
nvm use 22
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='your-strong-password' npm run admin:create
```

Or run interactively:

```bash
npm run admin:create
```

Optional env:

- `ADMIN_ROLE` — `owner` (default), `admin`, or `viewer`

The script validates email/password, stores a scrypt hash, and refuses duplicate emails. It never prints the password or hash.

There is **no** public HTTP endpoint for admin creation.

## Login

```http
POST /admin/auth/login
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "your-strong-password"
}
```

Response:

```json
{
  "token": "<admin-session-token>",
  "admin": {
    "id": "...",
    "email": "you@example.com",
    "role": "owner",
    "createdAt": "...",
    "lastLoginAt": "..."
  }
}
```

Use the token on subsequent requests:

```http
Authorization: Bearer <admin-session-token>
```

Other auth routes:

- `GET /admin/auth/me`
- `POST /admin/auth/logout`

## Roles

| Role | Access in this phase |
| --- | --- |
| `viewer` | Read-only admin user APIs |
| `admin` | Same read-only access (reserved for future mutations) |
| `owner` | Highest privilege (future destructive ops) |

Inactive admins cannot log in.

## Read-only endpoints

- `GET /admin/dashboard` — aggregate read-only metrics
- `GET /admin/users?q=&accountType=guest|protected&limit=&cursor=`
- `GET /admin/users/:userId`
- `GET /admin/users/:userId/wardrobe`
- `GET /admin/users/:userId/outfits`
- `GET /admin/users/:userId/wear-history`
- `GET /admin/users/:userId/family`

`:userId` accepts internal user id or `publicId`.

List responses use cursor pagination (`nextCursor`).

## Security notes

- Admin sessions are stored separately from user `sessions`.
- Only session token hashes are stored server-side.
- Admin routes reject ordinary user bearer tokens.
- Audit log records login/logout and user inspection actions without passwords, OTP codes, or session tokens.
- Password hashes, session tokens, and OTP material are never returned by admin APIs.

## Config

`.env` (names only):

- `ADMIN_SESSION_TTL_HOURS` — admin session lifetime in hours (default `24`)
- `ADMIN_WEB_ORIGIN` — allowed browser origin(s) for admin panel (comma-separated), e.g. `http://localhost:5173`

## Local development example

```bash
cd server
nvm use 22
npm run dev
ADMIN_EMAIL=admin@local.test ADMIN_PASSWORD='LocalAdmin123!' npm run admin:create
curl -s -X POST http://127.0.0.1:3000/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local.test","password":"LocalAdmin123!"}'
```

Then call `GET /admin/users` with the returned bearer token.

## Tests

```bash
npm run test:admin-backend
```
