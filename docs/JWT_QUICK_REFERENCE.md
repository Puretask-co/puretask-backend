# JWT Authentication - Quick Reference Card

## 🚀 Quick Start (30 seconds)

### 1. Add to `.env`
```bash
JWT_SECRET=c2f5bd0adc095f8c4571124e69c23177baa22aedfc8486c185e38279e09c7c9d2654d3d979a09a5beea07766bd56bb32a35f4c20ced90e9e069bfca9bba068c8
```

### 2. Protect Any Route
```typescript
import { auth } from "../lib/auth";

router.get("/protected", auth(), (req, res) => {
  const userId = req.user!.id;    // ✅ Available after auth()
  const role = req.user!.role;     // "client" | "cleaner" | "admin"
  res.json({ userId, role });
});
```

### 3. Role-Specific Routes
```typescript
router.post("/cleaner-only", auth("cleaner"), handler);
router.post("/client-only", auth("client"), handler);
router.delete("/admin-only", auth("admin"), handler);
```

---

## 📋 Common Patterns

### Register User
```typescript
POST /auth/register
Body: { email, password, role?: "client" | "cleaner" }
Response: { token, user }
```

### Login
```typescript
POST /auth/login
Body: { email, password }
Response: { token, user }
```

### Get Current User
```typescript
GET /auth/me
Headers: { Authorization: "Bearer <token>" }
Response: { user, profile }
```

### Using Token in Requests
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:4000/api/endpoint
```

---

## 🔧 File Locations

| What | Where |
|------|-------|
| JWT Secret Config | `src/config/env.ts` |
| JWT Functions | `src/lib/auth.ts` |
| Auth Middleware | `src/lib/auth.ts` → `auth()` |
| Auth Routes | `src/routes/auth.ts` |
| Auth Service | `src/services/authService.ts` |

---

## ✅ Security Checklist

- ✅ JWT_SECRET is 128+ characters
- ✅ JWT_SECRET is in `.env` (not committed)
- ✅ Same JWT_SECRET across all environments
- ✅ Tokens expire (30d default)
- ✅ Passwords hashed with bcrypt
- ✅ Auth middleware on protected routes
- ✅ Role-based access control

---

## 🧪 Testing

```bash
# 1. Register
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234","role":"client"}'

# 2. Save token from response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 3. Use token
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/auth/me
```

---

## 🚨 Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing auth token` | No Authorization header | Add `Authorization: Bearer <token>` |
| `Invalid token` | Wrong JWT_SECRET | Check `.env` has correct secret |
| `Token expired` | Token older than 30d | Login again |
| `FORBIDDEN` | Wrong role | Check user has required role |

---

## 💡 Pro Tips

1. **Admin bypasses all role checks** - Admin users can access any role-specific route
2. **Use `auth()` for any authenticated user** - Don't specify role unless needed
3. **Token in response** - Register and login both return tokens
4. **Refresh endpoint** - Use `POST /auth/refresh` to get new token
5. **Optional auth** - Use `authMiddlewareAttachUser` for public routes

---

**Need more details?** See `docs/JWT_AUTHENTICATION_GUIDE.md`

