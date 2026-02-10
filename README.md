# PureTask Backend

PureTask Backend API - Uber-style cleaning marketplace built with Node.js, TypeScript, Express, and PostgreSQL.

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- PostgreSQL database (Neon recommended)
- Stripe account (for payments)
- SendGrid account (for emails)
- Twilio account (for SMS)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd puretask-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and fill in all required values
   ```

4. **Run database migrations**
   ```bash
   # Migrations are in DB/migrations/
   # Run them against your database
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Verify it's working**
   ```bash
   curl http://localhost:4000/health
   ```

## Development

### Running the Server

```bash
# Development mode (auto-reload on changes)
npm run dev

# Start both frontend and backend
npm run dev:all

# Stop all dev servers
npm run dev:stop
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Code Quality

```bash
# Type checking
npm run typecheck

# Linting
npm run lint
```

## API Documentation

### Swagger UI

Once the server is running, visit:
- **Development**: http://localhost:4000/api-docs
- **Production**: https://api.puretask.com/api-docs (if `ENABLE_API_DOCS=true`)

The Swagger UI provides:
- Interactive API documentation
- Try-it-out functionality
- Request/response schemas
- Authentication testing

### API Endpoints

See `/api-docs` for complete documentation. Main endpoints include:

**Authentication:**
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user

**Jobs:**
- `POST /jobs` - Create a job (client)
- `GET /jobs/:id` - Get job details
- `POST /jobs/:id/accept` - Accept job (cleaner)
- `POST /jobs/:id/check-in` - Check in to job (cleaner)
- `POST /jobs/:id/approve` - Approve completed job (client)

**Health:**
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (database connectivity)
- `GET /health/live` - Liveness check

## Authentication

PureTask uses JWT (JSON Web Tokens) for authentication.

### Getting a Token

1. Register or login via `/auth/register` or `/auth/login`
2. Receive a JWT token in the response
3. Include token in subsequent requests: `Authorization: Bearer <token>`

### Token Format

Tokens expire after 30 days (configurable via `JWT_EXPIRES_IN`).

### Protected Routes

Most routes require authentication. Include the JWT token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <your-token>" http://localhost:4000/jobs
```

## Project Structure

```
src/
├── config/          # Configuration (env, swagger)
├── core/            # Core business logic
├── db/              # Database client
├── lib/             # Shared utilities (auth, errors, logger)
├── middleware/      # Express middleware
├── routes/          # API route handlers
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── workers/         # Background workers/cron jobs
└── index.ts         # Application entry point
```

## Deployment

### Environment Variables

See `.env.example` for all required variables. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `STRIPE_SECRET_KEY` - Stripe API key
- `SENDGRID_API_KEY` - SendGrid API key for emails
- `NODE_ENV` - `development` | `production`

### Docker

```bash
# Build image
docker build -t puretask-backend .

# Run container
docker run -p 4000:4000 --env-file .env puretask-backend
```

### Railway

The project includes `railway.json` and `railway.toml` for Railway deployment.

## Background Workers

Workers run on a schedule to handle:
- Auto-cancelling expired jobs
- Processing payouts
- Sending reminders
- Calculating reliability scores
- And more...

See `src/workers/scheduler.ts` for the schedule.

Run workers manually:
```bash
npm run worker:auto-cancel
npm run worker:payout-weekly
# etc.
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Run `npm test` and `npm run lint`
5. Submit a pull request

## License

UNLICENSED - Private project

## Docker

To build and run:

```bash
docker build -t puretask-backend .
docker run -p 4000:4000 --env-file .env puretask-backend
```

Make sure your Neon `DATABASE_URL` is reachable from the container.
