# Wardrobe AI Admin API (MVP)

Backend admin API for operational support, plus a separate read-only web panel in `admin/`.

## Purpose

- **One identity:** admin operators are normal `users` rows (same email as the mobile app)
- **Same password:** `user_password_credentials` (no separate admin password table)
- **Separate admin session:** `admin_sessions` tokens never authorize mobile routes, and mobile bearer tokens never authorize `/admin/*`
- Role-based access control (`owner`, `admin`, `viewer`) via `users.admin_role`
- Audit trail for admin actions
- Read-only user inspection APIs

Admin access requires:

- verified email on `users`
- usable password in `user_password_credentials`
- `users.admin_role` in (`viewer`, `admin`, `owner`)
- `users.admin_is_active = 1`

## Password storage

Admin login uses the same scrypt material as mobile email/password login in `user_password_credentials` (`password_hash`, `password_salt`).

Legacy `admin_users.password_*` columns are migrated for old databases only; new admin access is granted with `admin:set-role`, not separate admin passwords.

## Grant admin access (CLI)

The user must already exist as a normal app user with verified email and password.

From `server/` with Node 22:

```bash
nvm use 22
npm run admin:set-role -- --email you@example.com --role owner
```

Roles: `viewer`, `admin`, `owner`. Updates `users.admin_role` and `updated_at`. Password and existing sessions are unchanged.

Remove admin access:

```bash
npm run admin:set-role -- --email you@example.com --role none
```

Safe output examples:

- `Updated you@example.com role to owner`
- `Removed admin access for you@example.com`

`npm run admin:create` is **deprecated** (exits with instructions). Do not create duplicate admin identities.

There is **no** public HTTP endpoint for admin creation.

## Legacy `admin_users` migration

On startup, the server:

1. Adds `users.admin_role` and `users.admin_is_active` when missing
2. Maps legacy `admin_users` rows onto matching `users.email` (preserves highest role: viewer < admin < owner)
3. Rebuilds `admin_sessions` to reference `users.id`
4. Remaps audit/settings foreign keys to `users.id`

Unmatched legacy admin emails are logged as warnings; no silent user creation.

The `admin_users` table is kept for now and may be removed in a later cleanup migration.

## Cleanup test-generated admin rows (dev)

If admin backend tests were previously run against the dev database, you may have leftover `@example.com` test admins. Safe cleanup:

```bash
npm run admin:cleanup-test-data
# or non-interactive:
npm run admin:cleanup-test-data -- --yes
```

Clears `admin_role` on matching test users and removes their admin sessions/audit rows. Real operator emails are never matched.

## Admin backend tests and database isolation

`npm run test:admin-backend` and `npm run test:ai-usage-settings` use a temporary SQLite file via `WARDROBE_DB_PATH`. They do **not** write to `server/data/wardrobe-ai.sqlite`.

## Login

```http
POST /admin/auth/login
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "your-app-password"
}
```

Same credentials as `POST /auth/password/login`, but the user must have `admin_role` set. Wrong password or non-admin users receive a generic 401 (`INVALID_ADMIN_CREDENTIALS`) without leaking whether the account exists or has admin access.

Success:

```json
{
  "token": "<admin-session-token>",
  "admin": {
    "id": "<users.id>",
    "email": "you@example.com",
    "role": "owner"
  }
}
```

Use `Authorization: Bearer <admin-session-token>` on `/admin/*` routes only.

## Session and `/admin/auth/me`

```http
GET /admin/auth/me
Authorization: Bearer <admin-session-token>
```

```http
POST /admin/auth/logout
Authorization: Bearer <admin-session-token>
```

## Roles (RBAC)

Source of truth: `users.admin_role`.

| Role | Access |
| --- | --- |
| `viewer` | Read-only admin APIs |
| `admin` | Read + safe settings mutations |
| `owner` | Highest privilege |

## Local dev quick start

Register/login in the app (or seed a user), then:

```bash
npm run admin:set-role -- --email admin@local.test --role owner
```

Start server (`npm run dev`) and admin UI; log in with the same email/password as the app.
