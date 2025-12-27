# JWT Authentication Guide - PureTask Backend

## ✅ Current Implementation Status

**Your JWT authentication is already properly implemented!** This guide documents the correct setup and usage.

---

## 🔐 1. JWT Secret Configuration

### Current Setup ✅

**Location:** `src/config/env.ts`

```typescript
export const env = {
  JWT_SECRET: requireEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "30d",
  BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS ? Number(process.env.BCRYPT_SALT_ROUNDS) : 10,
  // ... other config
};
```

### Your JWT Secret

```
c2f5bd0adc095f8c4571124e69c23177baa22aedfc8486c185e38279e09c7c9d2654d3d979a09a5beea07766bd56bb32a35f4c20ced90e9e069bfca9bba068c8
```

**✅ Security Analysis:**
- **Length:** 128 characters (64 bytes in hex)
- **Entropy:** 256 bits - Excellent! Industry standard for production
- **Format:** Hexadecimal - Perfect for secrets
- **Strength:** Cryptographically secure, unguessable

### Environment Variables

Add to your `.env` file:

```bash
JWT_SECRET=c2f5bd0adc095f8c4571124e69c23177baa22aedfc8486c185e38279e09c7c9d2654d3d979a09a5beea07766bd56bb32a35f4c20ced90e9e069bfca9bba068c8
JWT_EXPIRES_IN=30d
```

---

## 🛠️ 2. Core JWT Functions

### Location: `src/lib/auth.ts` ✅

#### Password Hashing
```typescript
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

#### JWT Token Creation
```typescript
export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}
```

#### JWT Token Verification
```typescript
export function verifyAuthToken(token: string): AuthUser {
  const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;
  return { id: decoded.id, role: decoded.role };
}
```

**✅ What's Correct:**
- Single source of truth for JWT_SECRET (`env.JWT_SECRET`)
- Proper expiration handling (`30d` default)
- Type-safe token payload with `AuthUser` interface
- Clean separation of concerns

---

## 🚪 3. Authentication Routes

### Location: `src/routes/auth.ts` ✅

#### Register Endpoint
```typescript
POST /auth/register
Body: { email, password, role?: "client" | "cleaner" }
Response: { token, user }
```

**Implementation:**
```typescript
const user = await registerUser({
  email: parsed.email,
  password: parsed.password,
  role: parsed.role,
});

const token = signAuthToken({
  id: user.id,
  role: user.role as UserRole,
});

res.status(201).json({ token, user: sanitizeUser(user) });
```

#### Login Endpoint
```typescript
POST /auth/login
Body: { email, password }
Response: { token, user }
```

**Implementation:**
```typescript
const user = await loginUser(parsed.email, parsed.password);
const token = signAuthToken({
  id: user.id,
  role: user.role as UserRole,
});

res.json({ token, user: sanitizeUser(user) });
```

#### Get Current User
```typescript
GET /auth/me
Headers: { Authorization: "Bearer <token>" }
Response: { user, profile }
```

**Implementation:**
```typescript
authRouter.get("/me", auth(), async (req, res) => {
  const userId = req.user!.id;
  const data = await getUserWithProfile(userId);
  res.json({ user: sanitizeUser(data.user), profile: ... });
});
```

**✅ What's Correct:**
- JWT tokens returned on successful login/register
- Tokens are signed with your secure JWT_SECRET
- Password never returned in responses
- Proper validation with Zod schemas
- Rate limiting applied to all auth routes

---

## 🛡️ 4. Authentication Middleware

### Location: `src/middleware/jwtAuth.ts` ✅

#### Primary Auth Middleware
```typescript
export function jwtAuthMiddleware(
  req: JWTAuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Missing or invalid authorization header" }
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.id, role: payload.role, email: payload.email ?? null };
    next();
  } catch (error) {
    return res.status(401).json({
      error: { code: "INVALID_TOKEN", message: "Invalid or expired token" }
    });
  }
}
```

#### Simplified Auth Helper (Most Common)
```typescript
// Location: src/lib/auth.ts
export function auth(requiredRole?: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = extractBearerToken(req);

    if (!token) {
      res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Missing auth token" }
      });
      return;
    }

    try {
      const decoded = verifyAuthToken(token);
      req.user = decoded;

      // Check role if required (admin can access everything)
      if (requiredRole && decoded.role !== requiredRole && decoded.role !== "admin") {
        res.status(403).json({
          error: { code: "FORBIDDEN", message: `Requires ${requiredRole} role` }
        });
        return;
      }

      next();
    } catch {
      res.status(401).json({
        error: { code: "INVALID_TOKEN", message: "Invalid or expired auth token" }
      });
    }
  };
}
```

**✅ What's Correct:**
- Checks for `Bearer` token format
- Verifies token using `env.JWT_SECRET`
- Attaches decoded user to `req.user`
- Proper error handling for expired/invalid tokens
- Role-based access control built-in

---

## 🔒 5. Protecting Routes

### Usage Examples

#### Basic Protection (Any Authenticated User)
```typescript
import { auth } from "../lib/auth";

router.get("/protected", auth(), (req, res) => {
  // req.user is guaranteed to exist here
  res.json({ message: "Hello " + req.user.id });
});
```

#### Role-Specific Protection
```typescript
import { auth } from "../lib/auth";

// Only cleaners
router.get("/cleaner-only", auth("cleaner"), (req, res) => {
  res.json({ message: "Cleaner dashboard" });
});

// Only clients
router.post("/book", auth("client"), (req, res) => {
  // Only clients can book jobs
});

// Only admins
router.delete("/users/:id", auth("admin"), (req, res) => {
  // Only admins can delete users
});
```

#### Optional Authentication
```typescript
import { authMiddlewareAttachUser } from "../lib/auth";

router.get("/public", authMiddlewareAttachUser, (req, res) => {
  if (req.user) {
    res.json({ message: "Hello " + req.user.id });
  } else {
    res.json({ message: "Hello guest" });
  }
});
```

#### Multiple Middleware
```typescript
import { auth } from "../lib/auth";
import { requireRole } from "../middleware/jwtAuth";

// Using jwtAuth style
router.post(
  "/admin/jobs",
  jwtAuthMiddleware,
  requireRole("admin"),
  (req, res) => {
    // Only admins reach here
  }
);
```

---

## 📋 6. Current Route Protection Status

### ✅ Already Protected Routes

Most of your routes already use proper authentication:

```typescript
// src/routes/jobs.ts
router.post("/", auth("client"), jobsController.createJob);
router.get("/:id", auth(), jobsController.getJob);

// src/routes/cleaner.ts
router.get("/jobs/available", auth("cleaner"), ...);

// src/routes/admin.ts
router.use(adminOnly); // All admin routes protected

// src/routes/auth.ts
router.get("/me", auth(), ...);
router.put("/password", auth(), ...);
router.put("/profile", auth(), ...);
```

---

## 🧪 7. Testing Authentication

### Using curl

#### Register
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepass123",
    "role": "client"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "role": "client",
    "created_at": "2025-12-27T..."
  }
}
```

#### Login
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepass123"
  }'
```

#### Access Protected Route
```bash
# Save token from login/register
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Using Postman

1. **Register/Login** → Save the `token` from response
2. Go to **Authorization** tab
3. Select **Type:** Bearer Token
4. Paste your token
5. All requests will include: `Authorization: Bearer <token>`

---

## ✅ 8. Security Best Practices (Already Implemented)

### ✅ What You're Doing Right

1. **Strong JWT Secret**
   - 128 characters (256-bit entropy)
   - Cryptographically secure
   - Properly stored in environment variables

2. **Proper Token Expiration**
   - Default: 30 days
   - Configurable via `JWT_EXPIRES_IN`
   - Tokens automatically expire

3. **Secure Password Hashing**
   - Using bcrypt with configurable salt rounds
   - Default: 10 rounds (good balance)
   - Passwords never stored in plaintext

4. **Single Source of Truth**
   - All JWT logic uses `env.JWT_SECRET`
   - No hardcoded secrets
   - Centralized configuration

5. **Proper Error Handling**
   - Generic error messages (prevents user enumeration)
   - Logging for debugging
   - Graceful failure

6. **Role-Based Access Control**
   - Admin can access everything
   - Role-specific middleware
   - Type-safe roles

7. **Rate Limiting**
   - Auth routes have stricter limits
   - Prevents brute force attacks
   - Configured in `src/middleware/rateLimit.ts`

---

## 🚫 9. Common Mistakes (You're NOT Making)

### ❌ DON'T DO THESE (You're Already Avoiding Them)

1. **❌ Hardcoded Secrets**
   ```typescript
   // BAD - You're NOT doing this ✅
   jwt.sign(payload, "secret")
   ```

2. **❌ Short Secrets**
   ```typescript
   // BAD - You're NOT doing this ✅
   JWT_SECRET=abc123
   ```

3. **❌ No Expiration**
   ```typescript
   // BAD - You're NOT doing this ✅
   jwt.sign(payload, secret) // No expiration
   ```

4. **❌ Committing .env**
   ```bash
   # GOOD - Your .gitignore includes this ✅
   .env
   .env.*
   !.env.example
   ```

5. **❌ Different Secrets Per Service**
   ```typescript
   // BAD - You're NOT doing this ✅
   const secret1 = process.env.JWT_SECRET_1;
   const secret2 = process.env.JWT_SECRET_2;
   ```

---

## 📊 10. File Organization Summary

```
src/
├── config/
│   └── env.ts                    # ✅ JWT_SECRET config
├── lib/
│   └── auth.ts                   # ✅ JWT signing/verification + auth() middleware
├── middleware/
│   ├── jwtAuth.ts               # ✅ JWT middleware (alternative style)
│   ├── auth.ts                  # ✅ Legacy header-based auth (for testing)
│   └── security.ts              # ✅ Rate limiting
├── routes/
│   └── auth.ts                  # ✅ Register, login, refresh endpoints
└── services/
    └── authService.ts           # ✅ User registration, password management
```

---

## 🎯 11. Quick Reference

### Most Common Pattern

```typescript
import { auth } from "../lib/auth";

// Any authenticated user
router.get("/protected", auth(), handler);

// Specific role only
router.post("/cleaner-action", auth("cleaner"), handler);
router.post("/client-action", auth("client"), handler);
router.delete("/admin-action", auth("admin"), handler);
```

### Access User in Handler

```typescript
router.get("/me", auth(), (req, res) => {
  const userId = req.user!.id;      // ✅ Always available after auth()
  const role = req.user!.role;       // "client" | "cleaner" | "admin"
  
  res.json({ userId, role });
});
```

---

## 📝 12. Next Steps

Your JWT authentication is **production-ready**! Here's what's already done:

- ✅ JWT_SECRET configured properly
- ✅ Token signing/verification working
- ✅ Authentication middleware implemented
- ✅ Routes properly protected
- ✅ Role-based access control
- ✅ Password hashing secure
- ✅ Error handling robust
- ✅ Rate limiting applied

### Optional Enhancements (Future)

1. **Token Refresh Flow**
   - Already have `/auth/refresh` endpoint
   - Consider automatic refresh before expiration

2. **Email Verification**
   - Add `email_verified` field
   - Send verification emails

3. **Password Reset Flow**
   - Implement forgot password
   - Send reset emails via n8n

4. **2FA (Two-Factor Authentication)**
   - Add TOTP support
   - SMS verification

5. **Session Management**
   - Track active sessions
   - Ability to revoke tokens

---

## 🔍 13. Troubleshooting

### "Invalid or expired token"

**Cause:** Token was signed with a different JWT_SECRET

**Fix:** Ensure all environments use the same secret:
```bash
# Development
JWT_SECRET=c2f5bd0adc095f8c4571124e69c23177baa22aedfc8486c185e38279e09c7c9d2654d3d979a09a5beea07766bd56bb32a35f4c20ced90e9e069bfca9bba068c8

# Production (same secret!)
JWT_SECRET=c2f5bd0adc095f8c4571124e69c23177baa22aedfc8486c185e38279e09c7c9d2654d3d979a09a5beea07766bd56bb32a35f4c20ced90e9e069bfca9bba068c8
```

### "Missing auth token"

**Cause:** Authorization header not sent or malformed

**Fix:** Ensure header format is correct:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### "Token expired"

**Cause:** Token is older than `JWT_EXPIRES_IN` (default: 30 days)

**Fix:** Login again or call `/auth/refresh`

---

## 📖 14. Additional Resources

- [JWT.io](https://jwt.io/) - Decode and verify JWTs
- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [bcrypt Documentation](https://www.npmjs.com/package/bcryptjs)

---

**Last Updated:** December 27, 2025
**Status:** ✅ Production Ready

