# Driver App API (NestJS)

NestJS API for the Driver App. Implements JWT auth and endpoints to replace the app's mock services.

## Quick Start

- Copy `.env.example` to `.env` and adjust if needed (defaults match provided MySQL):
  - host: 127.0.0.1, port: 33067, user: root, pass: 12345, db: driver_app
- Create schema & seed:
  - Execute SQL: `migrations/001_init.sql` against `driver_app`
- Install deps and run (requires Node 18+):
  - `npm i`
  - `npm run start:dev`

Docker (one command):

- `docker compose up --build`
  - Exposes MySQL at 33067 and API at 3007
  - Applies migrations in `migrations/` (e.g., 001_init.sql, 002_appointments.sql) automatically on start

API base URL: `http://localhost:3007/api`

Static files

- Upload endpoint: `POST /api/uploads` (form-data, key: `file`) → returns `{ url: "/static/<filename>" }`
- Public static base: `http://localhost:3007/static/`

## Endpoints

Auth

- POST `/api/auth/login` { email, password } -> { token, user }

Users / Profile

- GET `/api/users/me` (Bearer token)
- PATCH `/api/users/me` { email?, name?, avatarUrl?, birthDate? }
- GET `/api/users/students?schoolCode=SH000001&page=1&pageSize=20&q=` (coach only conceptually)

Policies

- GET `/api/policies/privacy`
- GET `/api/policies/terms`

Messages

- GET `/api/messages/conversations?page=1&pageSize=20&q=`
- GET `/api/messages/conversations/:id/messages?page=1&pageSize=100`
- POST `/api/messages/conversations/:id/read`
- POST `/api/messages/send` { conversationId, senderName, receiverId, receiverName, content, type? }

Invites

- GET `/api/invites/status?studentId=...`
- GET `/api/invites`
- POST `/api/invites?studentId=...`

Schools (coach)

- GET `/api/schools/me`
- PATCH `/api/schools/me` { name?, logoUrl?, bannerUrl? }

## Notes

- Default test accounts: student@driveviewer.com / 123456, coach@driveviewer.com / 123456.
- First login hashes the default password automatically if `passwordHash` is empty.
- Extend guards/roles as needed (current guard validates JWT; role checks can be added per-route).

## Development

- Stack: NestJS + TypeORM + MySQL + JWT
- Entities in `src/modules/*/*.entity.ts`
- Controllers/services per module
