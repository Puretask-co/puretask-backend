# PureTask Backend (v0.1)

This is a minimal but real backend for PureTask, built with:

- Node.js + TypeScript
- Express
- PostgreSQL (Neon)
- A job lifecycle state machine
- Job event emitter that writes to `job_events`

## Quick start

1. Copy `.env.example` to `.env` and fill the required secrets.

2. Install dependencies:

   npm install

3. Run in dev mode:

   npm run dev

4. Hit the health endpoint:

   GET http://localhost:4000/health

## Auth (temporary)

For now, auth is simulated with HTTP headers:

- `x-user-role`: `client` | `cleaner` | `admin`
- `x-user-id`: any string

Later you can swap this with Clerk, Supabase Auth, or your own JWT.

## Main endpoints

- `POST /jobs` (client) – create a job
- `GET /jobs/:id` – fetch a job
- `POST /jobs/:id/accept` (cleaner)
- `POST /jobs/:id/on-my-way` (cleaner)
- `POST /jobs/:id/check-in` (cleaner)
- `POST /jobs/:id/check-out` (cleaner)
- `POST /jobs/:id/submit-for-approval` (cleaner)
- `POST /jobs/:id/approve` (client)
- `POST /jobs/:id/dispute` (client)
- `POST /jobs/:id/cancel` (client/cleaner)

Each action:

1. Validates the request body with `zod`.
2. Applies the job state machine (`src/state/jobStateMachine.ts`).
3. Updates the `jobs.status` column.
4. Inserts a row into `job_events`.

## Admin API

- `GET /admin/jobs` – list recent jobs (role: admin)
- `GET /admin/job-events` – list recent job events (role: admin)

Use header:

- `x-user-role: admin`
- `x-user-id: admin-1`

## Docker

To build and run:

```bash
docker build -t puretask-backend .
docker run -p 4000:4000 --env-file .env puretask-backend
```

Make sure your Neon `DATABASE_URL` is reachable from the container.
