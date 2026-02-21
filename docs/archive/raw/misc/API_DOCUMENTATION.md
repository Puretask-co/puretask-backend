# API Documentation Guide

## Overview
PureTask Backend API documentation is available via Swagger UI and OpenAPI specification.

## Accessing Documentation

### Swagger UI
**URL**: `http://localhost:4000/api-docs` (development)
**URL**: `https://api.puretask.com/api-docs` (production)

**Features**:
- Interactive API explorer
- Test endpoints directly
- View request/response schemas
- Authentication support

### OpenAPI Specification
**URL**: `http://localhost:4000/api-docs/json`

**Usage**:
- Import into Postman
- Generate client SDKs
- API testing tools
- Documentation generators

## API Structure

### Base URL
- **Development**: `http://localhost:4000`
- **Production**: `https://api.puretask.com`

### Authentication
Most endpoints require JWT authentication:

```bash
# Get token
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use token
curl -X GET http://localhost:4000/jobs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Endpoint Categories

### Authentication (`/auth`)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user
- `PUT /auth/password` - Update password

### Jobs (`/jobs`)
- `GET /jobs` - List jobs
- `POST /jobs` - Create job
- `GET /jobs/:id` - Get job details
- `PUT /jobs/:id` - Update job
- `DELETE /jobs/:id` - Delete job
- `POST /jobs/:id/pay` - Pay for job

### User Data (`/user`) - GDPR
- `GET /user/data/export` - Export user data
- `DELETE /user/data` - Delete user data
- `POST /user/consent` - Record consent
- `GET /user/consent/:type` - Get consent status

### Health (`/health`)
- `GET /health` - Health check
- `GET /health/ready` - Readiness check

### Status (`/status`)
- `GET /status` - Operational status

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "requestId": "req-123",
    "timestamp": "2024-01-29T00:00:00.000Z"
  }
}
```

### Rate Limit Response
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please slow down.",
    "retryAfter": 900
  }
}
```

**Status**: `429 Too Many Requests`

## Rate Limits

### Headers
All responses include rate limit headers:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 250
X-RateLimit-Reset: 1706544000
```

### Limits
- **General API**: 300 requests per 15 minutes per IP
- **Auth Endpoints**: 200 requests per 15 minutes per IP
- **Endpoint-Specific**: Varies by endpoint

## Error Codes

### Authentication
- `UNAUTHENTICATED` - Missing or invalid token
- `INVALID_TOKEN` - Token expired or invalid
- `INVALID_CREDENTIALS` - Wrong email/password

### Authorization
- `FORBIDDEN` - Insufficient permissions
- `ROLE_REQUIRED` - Wrong user role

### Validation
- `VALIDATION_ERROR` - Invalid input data
- `MISSING_REQUIRED_FIELD` - Required field missing

### Rate Limiting
- `RATE_LIMIT_EXCEEDED` - Too many requests

### Business Logic
- `JOB_NOT_FOUND` - Job doesn't exist
- `JOB_NOT_CANCELLABLE` - Job can't be cancelled
- `INSUFFICIENT_CREDITS` - Not enough credits

## Adding Documentation

### Swagger Comments
Add to route handlers:

```typescript
/**
 * @swagger
 * /jobs:
 *   get:
 *     summary: List jobs
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Job'
 */
router.get("/", async (req, res) => {
  // ...
});
```

### Schema Definitions
Add to `src/config/swagger.ts`:

```typescript
schemas: {
  Job: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      status: { type: 'string' },
      // ...
    },
  },
}
```

## Testing API

### Using Swagger UI
1. Open `/api-docs`
2. Click "Authorize"
3. Enter JWT token
4. Test endpoints interactively

### Using cURL
```bash
# Get token
TOKEN=$(curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.token')

# Use token
curl -X GET http://localhost:4000/jobs \
  -H "Authorization: Bearer $TOKEN"
```

### Using Postman
1. Import OpenAPI spec (`/api-docs/json`)
2. Set up environment variables
3. Configure authentication
4. Test endpoints

## Versioning

### Current Version
- **API Version**: v1
- **OpenAPI Version**: 3.0.0

### Future Versions
- Use URL versioning: `/v2/jobs`
- Maintain backward compatibility
- Document breaking changes

## Best Practices

1. **Always Use HTTPS** in production
2. **Include Rate Limit Headers** in responses
3. **Use Consistent Error Format**
4. **Document All Endpoints**
5. **Version APIs** when making breaking changes

## Next Steps

1. **Complete API Documentation**
   - Document all endpoints
   - Add request/response examples
   - Document error codes

2. **Generate Client SDKs**
   - Use OpenAPI generator
   - Support multiple languages
   - Publish to package registries

3. **API Versioning**
   - Plan versioning strategy
   - Document migration guides
   - Maintain backward compatibility
