# Driver App API (NestJS)

NestJS API for the Driver App. Implements JWT auth and endpoints to replace the app's mock services.

## Quick Start

- Copy `.env.example` to `.env` and adjust if needed (defaults match provided MySQL):
  - host: 127.0.0.1, port: 33067, user: root, pass: 12345, db: driver_app
  - 若使用本地 docker 容器 `mysql81`，连接信息为 `port=3306, user=root, pass=123456`
- Create schema & seed:
  - `npm run init-db` （会依次执行 `sql/*.sql`，包括新增加的 `app_updates` 表及示例数据）
- Install deps and run (requires Node 18+):
  - `npm i`
  - `npm run start:dev`

Docker (one command):

- `docker compose up --build`
  - Exposes MySQL at 33067 and API at 3007
  - Applies migrations in `migrations/` (e.g., 001_init.sql, 002_appointments.sql) automatically on start

API base URL: `http://localhost:3008/api`

Static files

- Upload endpoint: `POST /api/uploads` (form-data, key: `file`) → returns `{ url: "/static/<filename>" }`
- Public static base: `http://localhost:3008/static/`

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

App Updates

- GET `/api/app-updates/check?platform=ios&currentVersion=1.0.0&currentBuild=1`
  - `platform`: `ios` 或 `android`
  - 返回 `{ hasUpdate, forceUpdate, latest: { version, buildNumber, versionCode, downloadUrl, releaseNotes } }`

## Notes

- Default test accounts: student@driveviewer.com / 123456, coach@driveviewer.com / 123456.
- First login hashes the default password automatically if `passwordHash` is empty.
- Extend guards/roles as needed (current guard validates JWT; role checks can be added per-route).

## Development

- Stack: NestJS + TypeORM + MySQL + JWT
- Entities in `src/modules/*/*.entity.ts`
- Controllers/services per module
