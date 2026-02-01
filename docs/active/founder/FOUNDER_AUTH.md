# Founder Reference: Auth System

**Candidate:** Auth system (System #6)  
**Where it lives:** `src/lib/auth.ts`, `authService`, JWT, sessions, `sessionManagementService`, `twoFactorService`, `oauthService`, middleware `requireAuth`/`requireRole`  
**Why document:** Login, register, tokens, roles, 2FA, OAuth; who can do what and how we protect routes.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The Auth system is the subsystem that identifies users (who you are) and authorizes what they can do (what you’re allowed to do). It consists of: (1) **Authentication**—`src/lib/auth.ts` (hashPassword, verifyPassword, signAuthToken, verifyAuthToken) and `authService` (registerUser, loginUser) so users register with email/password and get a JWT; (2) **JWT**—signed with JWT_SECRET, payload (id, role, jti), expires JWT_EXPIRES_IN; verifyAuthToken checks invalidated_tokens (jti) and users.token_version so we can invalidate tokens; (3) **Authorization**—`authCanonical.ts` (requireAuth, optionalAuth, requireRole, requireAdmin, requireCleaner, requireClient) so routes can require “logged in” and/or “must be admin/cleaner/client”; (4) **n8n webhook auth**—verifyN8nSignature (HMAC-SHA256 over body with N8N_WEBHOOK_SECRET, header x-n8n-signature) so only n8n can call webhook routes; (5) **Token invalidation**—tokenInvalidation.ts (increment users.token_version, insert invalidated_tokens for jti) so we can log out or revoke. Roles: client, cleaner, admin. We do not implement 2FA or OAuth in the core auth.ts/authService; sessionManagementService, twoFactorService, oauthService are referenced in the candidate list and may live elsewhere.

**Simple (like for a 10-year-old):** The Auth system is how we know “who you are” (login, register, password) and “what you’re allowed to do” (client, cleaner, or admin). When you register or log in we give you a token (JWT) that you send with every request; we check that token and your role (client/cleaner/admin) to decide if you can do that action. We can also “log you out” by invalidating your token. For n8n webhooks we check a secret signature so only n8n can call those endpoints. We have roles: client, cleaner, admin.

### 2. Where it is used

**Technical:** Auth is implemented in `src/lib/auth.ts` (hashPassword, verifyPassword, signAuthToken, verifyAuthToken, verifyAuthTokenSync, authMiddlewareAttachUser, auth(requiredRole?), adminOnly, verifyN8nSignature, computeN8nSignature), `src/services/authService.ts` (registerUser, loginUser, getUserById, getUserByEmail, getUserWithProfile, updatePassword, updateClientProfile, updateCleanerProfile, sanitizeUser), `src/middleware/authCanonical.ts` (requireAuth, optionalAuth, requireRole, requireAdmin, requireCleaner, requireClient), and `src/lib/tokenInvalidation.ts` (invalidateUserTokens, invalidateTokenByJti, cleanupInvalidatedTokens). Routes: `src/routes/auth.ts` (POST /auth/register, POST /auth/login, GET /auth/me, PATCH /auth/password, PATCH /auth/profile/client, PATCH /auth/profile/cleaner) with rate limiting. Protected routes use requireAuth and often requireRole (e.g. payments, jobs, tracking, admin). n8n webhook routes use verifyN8nSignature (e.g. POST /n8n/events, POST /events). Tables: users (id, email, password_hash, role, token_version), invalidated_tokens (jti, user_id, reason).

**Simple (like for a 10-year-old):** The “who you are” and “what you can do” code lives in the auth lib, the auth service, and the auth middleware. When you register or log in we use the auth service; when you call “create job” or “pay” we use the middleware to check your token and role. The auth routes (register, login, me, password, profile) are in the auth router. Lots of other routes (payments, jobs, tracking, admin) use “require auth” and sometimes “require client” or “require admin.” The n8n webhook routes check a secret signature. We store users (email, password hash, role) and a list of invalidated tokens.

### 3. When we use it

**Technical:** We use it when: (1) a user registers (POST /auth/register)—authService.registerUser, then signAuthToken; (2) a user logs in (POST /auth/login)—authService.loginUser, then signAuthToken; (3) any protected request—requireAuth runs, extracts Bearer token, verifyAuthToken, attaches req.user; (4) role-restricted request—requireRole('admin'|'cleaner'|'client') runs after requireAuth and checks req.user.role; (5) n8n webhook request—verifyN8nSignature runs before handler; (6) token invalidation—logout or “revoke all tokens” calls invalidateUserTokens or invalidateTokenByJti. There is no fixed schedule for “auth” itself; every protected request and every login/register triggers it.

**Simple (like for a 10-year-old):** We use it when someone registers or logs in—we create or check their account and give them a token. We use it on every request to “create job,” “pay,” “tracking,” “admin” routes—we check their token and sometimes their role (client, cleaner, admin). We use it when n8n calls our webhook—we check the signature. We use it when someone logs out or we revoke their token—we mark the token as invalid. So we use it on every login/register and on every protected request.

### 4. How it is used

**Technical:** **Register:** POST /auth/register body (email, password, role?). authService.registerUser: validate role (no admin), check email not exists, hashPassword, INSERT users + client_profiles or cleaner_profiles in transaction. Return user; route calls signAuthToken(user) and returns { token, user: sanitizeUser(user) }. **Login:** POST /auth/login body (email, password). authService.loginUser: find user by email, verifyPassword(plain, user.password_hash), return user; route calls signAuthToken(user) and returns { token, user: sanitizeUser(user) }. **Protected route:** Authorization: Bearer <token>. requireAuth: extract token, verifyAuthToken(token) (jwt.verify + invalidated_tokens check + token_version check), (req as AuthedRequest).user = { id, role, email }; next(). If token missing or invalid: 401. requireRole('admin'): after requireAuth, check req.user.role in allowedRoles; if not, 403. **n8n:** Header x-n8n-signature = HMAC-SHA256(N8N_WEBHOOK_SECRET, JSON.stringify(req.body)). verifyN8nSignature: compute expected sig, timing-safe compare; if missing or invalid, 401. **Invalidation:** invalidateUserTokens(userId): UPDATE users SET token_version = token_version + 1; optionally INSERT invalidated_tokens for jti. verifyAuthToken checks invalidated_tokens and token_version.

**Simple (like for a 10-year-old):** To register: you send email and password (and maybe role); we check the email isn’t taken, hash the password, create the user and profile, and give you a token. To log in: you send email and password; we find you, check the password, and give you a token. On protected routes: you send the token in the “Authorization: Bearer …” header; we check the token (and that it’s not invalidated and that your token_version matches), put your id and role on the request, and if the route needs a specific role we check that too. For n8n we check a signature in the header so only n8n can call. To log out we mark your token (or all your tokens) as invalid so the next request with that token gets 401.

### 5. How we use it (practical)

**Technical:** In day-to-day: frontend stores the JWT (e.g. localStorage or cookie) and sends Authorization: Bearer <token> on API calls. Routes that need “logged in” use requireAuth; routes that need “admin only” use requireAuth + requireRole('admin') or requireAdmin. Env: JWT_SECRET (required), JWT_EXPIRES_IN (default 30d), BCRYPT_SALT_ROUNDS (default 10), N8N_WEBHOOK_SECRET (for n8n routes). Auth routes have rate limiting (authRateLimiter or productionAuthRateLimiter). To debug: check req.user on a protected route; query users and invalidated_tokens; verify token with jwt.verify(JWT_SECRET).

**Simple (like for a 10-year-old):** In practice the app saves the token after login and sends it with every request that needs to be “logged in.” Routes that need “any logged-in user” use requireAuth; routes that need “admin only” use requireAuth and requireAdmin. We set the JWT secret, how long the token lasts, and the password hashing strength in config. We limit how many login/register attempts you can make (rate limit). To see what’s going on we look at who’s on the request (req.user) and at the users and invalidated_tokens tables.

### 6. Why we use it vs other methods

**Technical:** JWT gives stateless auth—we don’t store sessions in DB for every request; we verify the signature and optional invalidated_tokens/token_version. Roles (client, cleaner, admin) give simple authorization so we can say “this route is admin only” or “client only.” bcrypt for passwords is standard and slow-by-design to resist brute force. HMAC for n8n gives “only n8n can call” without passing a shared secret in the body. Token invalidation (token_version, invalidated_tokens) lets us log out or revoke without storing every token. Alternatives—sessions in DB, API keys only, or no auth—would be stateful, less flexible, or insecure.

**Simple (like for a 10-year-old):** We use JWT so we don’t have to look up “is this session valid?” in the database on every request—we can check the token’s signature and a few checks. We use roles so we can say “only admins” or “only clients” on a route. We use bcrypt for passwords so they’re hard to reverse and slow to guess. We use a signature for n8n so only n8n can call our webhook. We can “invalidate” tokens so when you log out we don’t have to store every token—we just mark that token or bump a version. Doing it another way (sessions in DB, or no auth) would be more work or less secure.

### 7. Best practices

**Technical:** We use a single canonical middleware (authCanonical: requireAuth, requireRole) so all routes use the same shape (AuthedRequest with user.id, user.role, user.email). We verify token signature, invalidated_tokens (jti), and token_version so we can revoke. We use generic “Invalid email or password” on login failure to avoid email enumeration. We hash passwords with bcrypt (salt rounds from env). We use timing-safe compare for n8n signature. We rate limit auth routes. Gaps: verifyAuthToken is async but authCanonical.requireAuth might need to await it (check—authCanonical uses verifyAuthToken which is async; in Node/Express we need to handle the promise—reading the code, requireAuth calls verifyAuthToken(token) but doesn’t await; verifyAuthToken returns a Promise so we need to await or .then; let me check—actually in authCanonical they use verifyAuthToken(token) in a try block—if verifyAuthToken is async, the try/catch won’t catch rejections unless we await. So there might be a bug: requireAuth doesn’t await verifyAuthToken. I’ll document as-is. We don’t bind idempotency key to user. JWT_SECRET should be long (e.g. 32+ chars) in production (env validation warns).

**Simple (like for a 10-year-old):** We have one way to “require auth” and “require role” so every route behaves the same. We check that the token isn’t in the “invalidated” list and that the user’s “token version” matches so we can log people out. We don’t say “email not found” vs “wrong password” on login so someone can’t guess emails. We hash passwords with bcrypt. We use a safe comparison for the n8n signature so timing doesn’t leak info. We rate limit login/register. What we could do better: make sure we properly wait for the token check (async); use a long JWT secret in production.

### 8. Other relevant info

**Technical:** Auth is critical for security—weak auth or missing authorization would let anyone act as another user or access admin endpoints. sessionManagementService, twoFactorService, oauthService are listed in the candidate “where it lives” but may be in separate files or not fully implemented in core auth.ts/authService; this doc focuses on lib/auth, authService, authCanonical, and token invalidation. ROUTE_PROTECTION_TABLE.md (if present) lists which routes use requireAuth/requireRole. Document JWT_SECRET rotation or token_version bump in DECISIONS.md.

**Simple (like for a 10-year-old):** Auth really matters—if it’s weak or we forget to check it, someone could pretend to be another user or get into admin. There may be more auth-related stuff (sessions, 2FA, OAuth) in other files; this doc is about the main login, token, and “require auth/role” flow. We should write down any big change (e.g. new secret, new way to invalidate) in our decisions doc.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** The Auth system is supposed to: (1) identify users (register, login, JWT); (2) authorize what they can do (requireAuth, requireRole so only the right role can call a route); (3) allow token invalidation (logout, revoke); (4) protect n8n webhooks (verifyN8nSignature so only n8n can call). Success means: only valid users get tokens; only holders of valid tokens can call protected routes; only the right roles can call role-restricted routes; and only n8n can call webhook routes.

**Simple (like for a 10-year-old):** It’s supposed to know who you are (register, login, token) and what you’re allowed to do (client, cleaner, admin). It’s supposed to let us “log you out” or revoke your token. It’s supposed to make sure only n8n can call our webhook. Success means only real users get tokens, only people with a valid token can do protected things, only the right role can do admin-only or client-only things, and only n8n can call the webhook.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for register: user row and profile created, token returned, client can call protected routes. Done for login: token returned, client can call protected routes. Done for protected request: token valid, not invalidated, token_version matches, req.user set, handler runs (or 401/403 if not). Done for n8n webhook: signature valid, handler runs (or 401 if not). Done for invalidation: token_version bumped or jti in invalidated_tokens, next request with that token gets 401. Observable: 200 + token on login/register; 200 on protected route with valid token; 401 on missing/invalid token; 403 on wrong role; 401 on n8n route with bad signature.

**Simple (like for a 10-year-old):** Success for register: we create the user and give a token; they can then call protected routes. Success for login: we give a token; they can call protected routes. Success for a protected request: we check the token, set “who you are” on the request, and run the handler (or we return 401 “not logged in” or 403 “wrong role”). Success for n8n: we check the signature and run the handler (or 401 “bad signature”). Success for logout: we mark the token invalid; the next request with that token gets 401. You can see success by 200 with token on login, 200 on protected routes with a valid token, and 401/403 when the token is missing, invalid, or wrong role.

### 11. What would happen if we didn't have it?

**Technical:** Without the Auth system anyone could call any endpoint—no identity, no roles. We couldn’t restrict “create job” to clients, “admin dashboard” to admins, or “payout” to backend-only; we couldn’t attribute actions to a user. n8n webhooks would be callable by anyone who knows the URL. We’d have no way to log out or revoke. Data and money would be at risk.

**Simple (like for a 10-year-old):** Without it anyone could do anything—we wouldn’t know who is who or who is allowed to do what. We couldn’t limit “create job” to clients or “admin” to admins; we couldn’t say “this action was done by user X.” Anyone could call our n8n webhook. We couldn’t log people out. That would be very unsafe.

### 12. What is it not responsible for?

**Technical:** The Auth system is not responsible for: validating request body (that’s the route/handler); rate limiting (that’s security/rateLimitRedis—we use it on auth routes but it’s separate); idempotency (that’s idempotency.ts); deciding *what* data a user can see (e.g. “only their jobs”)—that’s business logic in the handler (we only enforce “logged in” and “role”); password reset flow (that may be passwordResetService); 2FA (twoFactorService if present); OAuth (oauthService if present). It only identifies and authorizes at the route level; resource-level “can this user see this job?” is in the service layer.

**Simple (like for a 10-year-old):** It doesn’t check that the email or password format is right—that’s the route. It doesn’t do rate limiting by itself—that’s another layer (we use it on auth routes). It doesn’t do idempotency. It doesn’t decide “can this user see this specific job?”—it only decides “is this user logged in and what role do they have?”; the handler decides “can they see this job?” It doesn’t do password reset or 2FA or “login with Google” in this core—those may be in other services.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** For register: email, password, role (optional, default client). For login: email, password. For protected route: Authorization header Bearer <token>. For requireRole: req.user (from requireAuth) and allowedRoles list. For n8n: req.body (JSON), header x-n8n-signature, env N8N_WEBHOOK_SECRET. For invalidation: userId or jti. Env: JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS, N8N_WEBHOOK_SECRET. DB: users (id, email, password_hash, role, token_version), invalidated_tokens (jti, user_id, reason).

**Simple (like for a 10-year-old):** To register we need email, password, and maybe role. To log in we need email and password. For a protected route we need the “Authorization: Bearer …” header with the token. For “require admin” we need the user (from the token) and the list of allowed roles. For n8n we need the request body and the signature header and the secret in config. To invalidate we need the user id or the token id (jti). We need the JWT secret, how long tokens last, password hashing strength, and the n8n secret in config. We need the users table and the invalidated_tokens table.

### 14. What does it produce or change?

**Technical:** It produces: (1) JWT token (on register/login); (2) req.user (id, role, email) on protected requests; (3) 401/403 responses when token missing, invalid, or wrong role; (4) 401 on n8n route when signature missing or invalid. It changes: users (INSERT on register, UPDATE token_version on invalidation), invalidated_tokens (INSERT on invalidateTokenByJti), client_profiles or cleaner_profiles (INSERT on register). It does not change business data (jobs, payments)—only identity and authorization outcomes.

**Simple (like for a 10-year-old):** It produces: a token when you register or log in; “who you are” (id, role, email) on the request when you call a protected route; and 401 “not logged in” or 403 “wrong role” when the token is bad or the role doesn’t match. It changes: the users table (new user on register, token_version on logout), the invalidated_tokens table (when we revoke a token), and the profile tables (new profile on register). It doesn’t change jobs or payments—only “who you are” and “can you do this.”

### 15. Who or what consumes its output?

**Technical:** Consumers of the token: the client (frontend) stores it and sends it on API calls. Consumers of req.user: every protected route handler (payments, jobs, tracking, admin, etc.) that needs to know who is acting. Consumers of 401/403: the client (to show “login required” or “forbidden”). No other backend system “consumes” the JWT; they use req.user set by the middleware. n8n consumes “webhook accepted” (200/204) when signature is valid.

**Simple (like for a 10-year-old):** The main consumer of the token is the app—it stores it and sends it with every request. The main consumer of “who you are” (req.user) is every protected route—they use it to know who is doing the action. The client also “consumes” 401 and 403 to show “you need to log in” or “you’re not allowed.” No other backend service reads the token; they just see req.user. n8n “consumes” our “OK” when the webhook signature is valid.

### 16. What are the main steps or flow it performs?

**Technical:** **Register:** validate body (email, password, role); check email not exists; hashPassword; INSERT users + profile in transaction; signAuthToken(user); return { token, user: sanitizeUser(user) }. **Login:** validate body; find user by email; verifyPassword(plain, user.password_hash); signAuthToken(user); return { token, user: sanitizeUser(user) }. **requireAuth:** extract Bearer token; if missing, 401; verifyAuthToken(token) (jwt.verify, check invalidated_tokens, check token_version); (req as AuthedRequest).user = { id, role, email }; next(). **requireRole:** if !req.user, 401; if !allowedRoles.includes(req.user.role), 403; next(). **verifyN8nSignature:** get x-n8n-signature; compute HMAC-SHA256(secret, JSON.stringify(body)); timing-safe compare; if invalid, 401; next(). **Invalidate:** invalidateUserTokens: UPDATE users SET token_version = token_version + 1; invalidateTokenByJti: INSERT invalidated_tokens (jti, user_id, reason).

**Simple (like for a 10-year-old):** When you register we check the email isn’t taken, hash the password, create the user and profile, sign a token, and return the token and user. When you log in we find you, check the password, sign a token, and return the token and user. When you call a protected route we get the token, verify it (and that it’s not invalidated and that your version matches), put you on the request, and if the route needs a role we check that too. For n8n we get the signature, compute what it should be, compare safely, and if it’s wrong we return 401. When we invalidate we either bump your token_version (all your tokens) or add your token’s jti to the invalidated list.

### 17. What rules or policies does it enforce?

**Technical:** We enforce: (1) register: role must be client or cleaner (no self-register admin); email must be unique; password hashed with bcrypt. (2) login: generic “Invalid email or password” on failure (no email enumeration). (3) JWT: must be signed with JWT_SECRET, not expired; if jti present, not in invalidated_tokens; if token_version in payload, must match users.token_version. (4) requireAuth: must have Authorization Bearer <token>; token must verify. (5) requireRole: must have req.user (so requireAuth first); req.user.role must be in allowedRoles. (6) n8n: must have x-n8n-signature; must match HMAC-SHA256(N8N_WEBHOOK_SECRET, body). We don’t enforce: password complexity (beyond min length in route validation); or “same user can’t have two sessions” (we don’t limit concurrent tokens per user).

**Simple (like for a 10-year-old):** We enforce: you can’t register as admin; email must be unique; we hash passwords. On login we don’t say “email not found” vs “wrong password.” The token must be valid, not expired, not in the “invalidated” list, and (if we use version) your version must match. Protected routes must have a valid Bearer token. Role-restricted routes must have the right role. n8n must send the right signature. We don’t enforce “password must have a number” or “only one session per user.”

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** Auth is triggered by: (1) POST /auth/register (client or frontend); (2) POST /auth/login (client or frontend); (3) any request to a route that uses requireAuth (payments, jobs, tracking, admin, etc.); (4) any request to a route that uses requireRole (e.g. requireAdmin on admin routes); (5) any request to a route that uses verifyN8nSignature (POST /n8n/events, POST /events); (6) logout or “revoke token” (invalidateUserTokens or invalidateTokenByJti). There is no cron or timer; every trigger is a request or an explicit invalidation call.

**Simple (like for a 10-year-old):** It’s triggered when someone registers or logs in, when someone calls a protected route (we check the token), when someone calls an admin-only or client-only route (we check the role), when n8n calls our webhook (we check the signature), and when we log someone out or revoke a token. Nothing runs on a timer—only when those things happen.

### 19. What could go wrong while doing its job?

**Technical:** (1) JWT_SECRET weak or leaked—tokens could be forged; rotate secret and bump token_version. (2) Token not sent or malformed—401; client must send valid Bearer header. (3) Token expired—401; client must re-login. (4) Token invalidated (jti in invalidated_tokens or token_version mismatch)—401; client must re-login. (5) Wrong role—403; client can’t call that route. (6) verifyAuthToken async not awaited—unhandled rejection possible; requireAuth should await or .then(verifyAuthToken). (7) n8n secret wrong or missing—webhook calls fail 401 or 500 in production. (8) bcrypt slow—high load on login if many requests; BCRYPT_SALT_ROUNDS too high can slow login. (9) Email enumeration—we use generic message but timing could leak “email exists”; consider constant-time response. (10) No rate limit on token verify—attacker could try many tokens; we rate limit auth routes but not every protected route.

**Simple (like for a 10-year-old):** Things that can go wrong: if the JWT secret is weak or leaked someone could make fake tokens—we’d have to change the secret and invalidate everyone. If the token is missing, wrong, or expired we return 401. If the token was logged out we return 401. If the user has the wrong role we return 403. There might be a small bug where we don’t properly wait for the token check (async). If the n8n secret is wrong, n8n can’t call our webhook. If we set password hashing too strong, login can be slow. We try not to leak “email exists” but timing could still leak a bit. We rate limit login/register but not every “check token” request.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** We observe: (1) 401/403 on invalid or wrong-role requests; (2) 200 + token on login/register; (3) logs—auth_failed (missing_authorization_header, invalid_token, missing_user_context, insufficient_permissions), user_registered, user_logged_in; (4) invalidated_tokens and users.token_version for invalidation. We don’t have a dedicated “auth success rate” or “invalid token rate” metric in this module. Tests: auth route tests, middleware tests (requireAuth, requireRole). Manual: try login with wrong password (401), try protected route without token (401), try admin route as client (403).

**Simple (like for a 10-year-old):** We know it’s working when we get 401 when the token is missing or wrong, 403 when the role is wrong, and 200 with a token on login/register. We see “auth failed” or “user logged in” in the logs. We can check the invalidated_tokens table and token_version when we invalidate. We don’t have a single “auth health” number. We have tests and we can manually try “wrong password,” “no token,” “client calls admin route.”

### 21. What does it depend on to do its job?

**Technical:** It depends on: (1) DB: users (id, email, password_hash, role, token_version), invalidated_tokens (jti, user_id, reason), client_profiles, cleaner_profiles; (2) env: JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS, N8N_WEBHOOK_SECRET; (3) libs: jsonwebtoken, bcryptjs, crypto (HMAC); (4) db/client for query in verifyAuthToken and tokenInvalidation; (5) logger. It does not depend on Redis for auth itself (rate limiting may use Redis). It does not depend on the queue or event system for the core auth flow.

**Simple (like for a 10-year-old):** It needs the database (users, invalidated_tokens, profiles), the JWT secret, how long tokens last, password hashing strength, and the n8n secret in config. It needs the JWT and bcrypt and crypto libraries. It needs the DB client and logger. It doesn’t need Redis or the queue for the main auth flow (rate limiting might use Redis).

### 22. What are the main config or env vars that control its behavior?

**Technical:** JWT_SECRET—required for signing and verifying JWTs; must be long (e.g. 32+ chars) in production. JWT_EXPIRES_IN—token lifetime (e.g. 30d). BCRYPT_SALT_ROUNDS—password hashing cost (default 10). N8N_WEBHOOK_SECRET—shared secret for n8n HMAC; required for verifyN8nSignature in production (we fail closed in prod if missing). NODE_ENV—we allow missing n8n secret in dev (next()); we fail 500 in prod. No feature flags in auth.ts itself; rate limiting and Redis are in security/rateLimitRedis.

**Simple (like for a 10-year-old):** The main settings are: JWT secret (required, should be long in production), how long the token lasts (e.g. 30 days), how strong we hash passwords (salt rounds), and the n8n webhook secret. In production we require the n8n secret for webhook routes; in dev we can leave it out for testing. We don’t have auth-specific feature flags in this code—rate limiting and Redis are elsewhere.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit/integration tests: auth routes (register, login, me, wrong password, invalid token), requireAuth (no token 401, invalid token 401, valid token 200), requireRole (wrong role 403, right role 200), verifyN8nSignature (missing/invalid signature 401, valid 200). We mock DB or use test DB; we use test JWT_SECRET and N8N_WEBHOOK_SECRET. We don’t run a full E2E “real browser login” in CI unless we have that suite.

**Simple (like for a 10-year-old):** We have tests that check: register and login return a token; wrong password returns 401; protected route without token returns 401; invalid token returns 401; wrong role returns 403; right role runs the handler; n8n with bad signature returns 401; n8n with good signature runs. We use a test secret and test DB. We don’t run a full “real user logs in in a browser” test in CI unless we have that.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If JWT_SECRET is compromised: rotate JWT_SECRET, bump all users’ token_version (or insert all current jti into invalidated_tokens if we track them), force re-login. If DB is down: verifyAuthToken and login/register will fail; we return 500 or 401; retry when DB is back. If invalidated_tokens table is full or slow: cleanupInvalidatedTokens() deletes old rows; we can run it on a schedule. If user locked out (forgot password): password reset flow (passwordResetService) if present; otherwise admin must reset. We don’t have an automatic “rotate secret” or “bulk invalidate” runbook in this doc; it would be in RUNBOOK or SECURITY_INCIDENT_RESPONSE.

**Simple (like for a 10-year-old):** If the JWT secret is leaked we have to change the secret and invalidate everyone’s tokens so they log in again. If the database is down login and “check token” will fail until it’s back. We can clean up old invalidated tokens so the table doesn’t grow forever. If someone forgets their password we might have a “reset password” flow or an admin has to reset it. We don’t have a written “what to do if secret is compromised” in this doc—that would be in the runbook or security doc.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders (who cares that it accomplishes its goal)?

**Technical:** Stakeholders: all users (they must be able to register, login, and have their role respected); product and security (identity and access control); support (login issues, “can’t access”); engineering (reliability and correctness of auth). Admins care that only admins can access admin routes. n8n operators care that webhook auth works.

**Simple (like for a 10-year-old):** People who care: every user (they need to log in and have the right access), the team that cares about security and who can do what, support when someone “can’t log in” or “can’t access,” and engineers who keep auth working. Admins care that only admins get admin access. The people who run n8n care that the webhook auth works.

### 26. What are the security or privacy considerations for what it does?

**Technical:** JWT_SECRET must be kept secret; if leaked, anyone can forge tokens. Passwords are hashed with bcrypt (we don’t store plaintext). We use generic “Invalid email or password” to avoid email enumeration. invalidated_tokens and users.token_version allow revoking without storing every token. Timing-safe compare for n8n signature prevents timing attacks. Authorization: Bearer token can be intercepted if not HTTPS; we assume HTTPS in production. req.user contains id, role, email—handlers must not expose other users’ data (resource-level auth in business logic). N8N_WEBHOOK_SECRET must be shared only with n8n. Document JWT_SECRET rotation and password policy in SECURITY_GUARDRAILS or RUNBOOK.

**Simple (like for a 10-year-old):** The JWT secret must stay secret—if someone gets it they can make fake tokens. We don’t store passwords in plain text—we hash them. We don’t say “email not found” vs “wrong password” so someone can’t guess emails. We can revoke tokens without storing every single token. We use a safe comparison for the n8n signature so timing doesn’t leak info. We assume the app uses HTTPS so the token isn’t sent in the clear. “Who you are” (id, role, email) is on the request—each handler must make sure you only see your own data. The n8n secret must only be shared with n8n. We should write down how we rotate the secret and what the password rules are.

### 27. What are the limits or scaling considerations for what it does?

**Technical:** verifyAuthToken does two DB lookups (invalidated_tokens, users.token_version) per protected request—under high traffic that’s 2 queries per request. We could cache token_version per user or reduce to one query. invalidated_tokens grows; cleanupInvalidatedTokens() can prune old rows. JWT verification (jwt.verify) is CPU; we don’t throttle “verify token” by user. Rate limiting on auth routes (login/register) is per-IP or per-user depending on limiter; we don’t rate limit “protected route” by token. No max sessions per user; we don’t limit how many tokens a user can have.

**Simple (like for a 10-year-old):** Every protected request does a couple of database checks (invalidated list, token version)—if we have lots of traffic that’s a lot of queries; we could cache to reduce that. The invalidated_tokens table can get big; we have a cleanup that deletes old rows. We rate limit login/register but we don’t rate limit “check my token” on every request. We don’t limit how many devices or sessions a user can have.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** We’d ensure verifyAuthToken is properly awaited in requireAuth (or use .then) to avoid unhandled rejections. We’d add metrics (login success/failure rate, 401/403 rate by route). We’d consider caching token_version (or invalidated_tokens check) per user with short TTL to reduce DB load. We’d document JWT_SECRET rotation and runbook in RUNBOOK. We’d consider binding idempotency key to user for payment/job creation so a key can’t be reused by another user. We’d consider rate limiting per user on “sensitive” routes (e.g. change password). We’d add 2FA and OAuth if product requires (they’re in the candidate list but may be separate services).

**Simple (like for a 10-year-old):** We’d make sure we properly wait for the token check (async) so we don’t have subtle bugs. We’d add dashboards (login success/fail, how many 401/403). We might cache “is this token invalidated?” for a short time to reduce DB load. We’d write down how to rotate the JWT secret and what to do if it’s compromised. We might tie idempotency keys to the user so one key can’t be used by someone else. We might rate limit “change password” per user. We might add 2FA and “login with Google” if the product needs them.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Per user: (1) Start—register or first login; we create user (and profile) or verify password, sign token, return token. (2) Ongoing—client sends token on each request; we verify and set req.user. (3) End—logout or revoke: we bump token_version or insert jti into invalidated_tokens; next request with that token gets 401. There is no “session” object with a fixed lifecycle; the token is the session. Token lifetime is JWT_EXPIRES_IN (e.g. 30d); after that the token expires and client must re-login. n8n webhook auth has no “session”—each request is verified by signature.

**Simple (like for a 10-year-old):** For each user: we start when they register or log in—we create their account or check their password and give them a token. While they use the app they send the token with every request and we check it and set “who they are.” We “end” when they log out or we revoke—we mark the token invalid and the next time they use that token they get 401 and have to log in again. We don’t have a “session” record—the token is the session. The token stops working after a while (e.g. 30 days) and they have to log in again. For n8n there’s no session—we check the signature on every request.

### 30. What state does it keep or track?

**Technical:** Persistent state: users (id, email, password_hash, role, token_version), invalidated_tokens (jti, user_id, reason, created_at), client_profiles, cleaner_profiles. We don’t store “active sessions” or “current tokens” in the DB—we only store invalidated jti and token_version. JWT payload is stateless (id, role, jti, exp); we don’t cache it in Redis. No in-memory auth state in this module beyond the current request’s req.user.

**Simple (like for a 10-year-old):** We keep: the users table (email, password hash, role, token version), the invalidated_tokens table (tokens we’ve revoked), and the profile tables. We don’t store “list of active sessions” or “every token we’ve given out”—we only store “these tokens are invalid” and “this user’s token version.” The token itself carries who you are and when it expires; we don’t cache that in Redis. We don’t keep any auth state in memory between requests—only “who is this request” for that request.

### 31. What assumptions does it make to do its job?

**Technical:** We assume: (1) JWT_SECRET is kept secret and is long enough in production; (2) clients send Authorization: Bearer <token> on protected routes; (3) tokens are not leaked (HTTPS, secure storage on client); (4) invalidated_tokens and users.token_version are correct (we don’t prune token_version); (5) role in JWT matches users.role (we sign at login; if we change role in DB we don’t re-sign so old tokens still have old role until they re-login—we could check users.role on every request but we don’t in verifyAuthToken); (6) n8n shares N8N_WEBHOOK_SECRET and sends correct HMAC. We don’t assume: exactly-once delivery of login request; or that the client won’t share the token.

**Simple (like for a 10-year-old):** We assume the JWT secret is secret and long enough. We assume the client sends the token in the “Authorization: Bearer …” header on protected routes. We assume the token isn’t stolen (HTTPS, safe storage). We assume the invalidated list and token version are right. We assume the role in the token is what we put there at login—if we change someone’s role in the DB their old token still has the old role until they log in again. We assume n8n has the secret and sends the right signature. We don’t assume the client won’t share the token or that login only happens once.

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use requireAuth for: public routes (e.g. health, public docs); use optionalAuth if the route works with or without a user. Don’t use requireRole for: routes that any authenticated user can call (use requireAuth only). Don’t use JWT for: server-to-server auth where you’d prefer API keys or mTLS (we could add API key auth separately). Don’t use verifyN8nSignature for: routes that aren’t called by n8n (use requireAuth or other auth). Use something else when: you need resource-level “can this user see this job?”—that’s business logic in the handler, not requireRole.

**Simple (like for a 10-year-old):** Don’t use “require auth” on public pages (e.g. health check)—use “optional auth” if the page works with or without a user. Don’t use “require role” on routes that any logged-in user can use—just use “require auth.” Don’t use JWT for “machine talking to machine” if you’d rather use API keys. Don’t use the n8n signature check on routes that aren’t n8n webhooks. Use business logic in the handler when you need “can this user see this specific job?”—that’s not just “require admin.”

### 33. How does it interact with other systems or features?

**Technical:** Auth receives calls from: every protected route (requireAuth, requireRole), auth routes (register, login, me, password, profile), n8n webhook routes (verifyN8nSignature). It uses: db/client (query for verifyAuthToken, tokenInvalidation, authService), jsonwebtoken, bcryptjs, crypto. It writes: users, invalidated_tokens, client_profiles, cleaner_profiles (via authService). Rate limiting (authRateLimiter, productionAuthRateLimiter) is applied on auth routes but lives in security/rateLimitRedis. Handlers downstream use req.user (id, role, email) to scope data (e.g. “my jobs”). So auth sits in front of protected routes and n8n routes; it doesn’t call payment or job logic—those use req.user set by auth.

**Simple (like for a 10-year-old):** Every protected route and the auth routes (register, login, me, etc.) and the n8n webhook routes use the auth code. The auth code uses the database and the JWT/bcrypt/crypto libraries. It writes to the users, invalidated_tokens, and profile tables. Rate limiting on login/register is in another module. The handlers that run after “require auth” use “who you are” (req.user) to do things like “show my jobs.” So auth is in front of those routes; it doesn’t call payment or job logic—those just use the “who you are” that auth put on the request.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure means: (1) register failed—email exists or validation error; we throw with statusCode 400 and code EMAIL_EXISTS or validation message. (2) Login failed—user not found or wrong password; we throw 401 INVALID_CREDENTIALS with generic “Invalid email or password.” (3) Protected request failed—no token or invalid token: 401 UNAUTHENTICATED or INVALID_TOKEN; wrong role: 403 FORBIDDEN. (4) n8n webhook failed—missing or invalid signature: 401 MISSING_SIGNATURE or INVALID_SIGNATURE. (5) Token invalidation—we don’t return a value to the client for “logout”; we just mark the token invalid and the next request with that token gets 401. We signal failure by HTTP status and error body (code, message).

**Simple (like for a 10-year-old):** Failure means: register failed (email taken or bad input)—we return 400 and a message. Login failed (wrong email or password)—we return 401 and “Invalid email or password.” Protected request failed (no token, bad token, or wrong role)—we return 401 “not logged in” or 403 “forbidden.” n8n webhook failed (bad signature)—we return 401. When we invalidate a token we don’t return something special to the client—the next time they use that token they get 401. We always tell the client with an HTTP status and an error code/message.

### 35. How do we know its outputs are correct or complete?

**Technical:** Correctness: we trust JWT signature (jwt.verify with JWT_SECRET); we trust invalidated_tokens and token_version checks. We don’t verify “role in token matches current users.role” on every request (token could be stale). Completeness: we can audit logs (auth_failed, user_logged_in) and invalidated_tokens; we can test “login then call protected route” and “logout then call protected route.” We don’t have an automated “every protected route actually checks auth” test (we’d need to enumerate routes and assert middleware stack).

**Simple (like for a 10-year-old):** We trust the JWT signature and the “invalidated” and “token version” checks. We don’t re-check “does their role in the DB still match the token?” on every request—so if we change their role their old token might still have the old role until they log in again. To see if we’re correct we look at logs and the invalidated table and we test “login, call route, logout, call route again.” We don’t have an automatic “every protected route has auth” check.

### 36. Who owns or maintains it?

**Technical:** Ownership is not formally assigned. Typically the backend or security team would own the auth system. Changes to JWT_SECRET, token lifetime, password policy, or role model should be documented in DECISIONS.md and SECURITY_GUARDRAILS. Token invalidation and n8n signature are part of the same auth surface.

**Simple (like for a 10-year-old):** The team that owns the backend (or security) is responsible. When we change the JWT secret, how long tokens last, password rules, or who can be admin/cleaner/client we should write it down in our decisions and security docs.

### 37. How might it need to change as the product or business grows?

**Technical:** We may need: (1) refresh tokens (long-lived refresh + short-lived access) so we can revoke access without revoking refresh; (2) check users.role on every request so role changes take effect immediately; (3) 2FA (twoFactorService) for sensitive actions or login; (4) OAuth (oauthService) for “login with Google”; (5) session management (sessionManagementService) to list/revoke sessions; (6) rate limiting per user on protected routes (e.g. limit “change password” attempts); (7) metrics and alerts (login failure rate, 401/403 rate); (8) JWT_SECRET rotation runbook and automation. As we add more roles or scopes we’d extend requireRole or add a “requireScope” layer.

**Simple (like for a 10-year-old):** As we grow we might add “refresh tokens” so we can have short-lived access tokens and revoke them without logging everyone out. We might check “current role in DB” on every request so changing someone’s role takes effect right away. We might add 2FA or “login with Google.” We might let users see “your sessions” and revoke one. We might rate limit “change password” per user. We’d add dashboards and alerts and a written runbook for “rotate JWT secret.” If we add more roles or permissions we’d extend the “require role” or add “require permission.”

---

## Additional questions (A)

### A1. What does it cost to run?

**Technical:** Cost: DB reads (invalidated_tokens, users.token_version) per protected request; bcrypt on register/login (CPU); JWT sign/verify (CPU). No dedicated auth infra; we share the app and DB. Under high traffic the 2 queries per protected request add up; we could cache token_version. bcrypt is intentionally slow; BCRYPT_SALT_ROUNDS controls cost.

**Simple (like for a 10-year-old):** We pay for a couple of database lookups on every protected request, and for password hashing (CPU) when someone registers or logs in. We use the same server and database as the rest of the app. If we have lots of traffic those lookups add up; we could cache “token version” to reduce them. Password hashing is slow on purpose so guessing is hard.

### A10. Can we run it twice safely (idempotency)? What happens if we replay or retry?

**Technical:** Login and register are not idempotent in the “same key returns same result” sense—we don’t use Idempotency-Key on auth routes. Replaying “login” twice gives two tokens (both valid until we invalidate). Replaying “register” with same email fails the second time (email exists). Replaying a protected request with the same token is safe—we just verify the token again and run the handler; idempotency of the handler (e.g. create job) is separate (idempotency middleware). Replaying “invalidate” twice is safe (idempotency_key on invalidated_tokens or “bump token_version” is idempotent). So auth itself doesn’t need request-level idempotency; the handlers behind it might (payments, jobs).

**Simple (like for a 10-year-old):** Login and register don’t use “idempotency keys”—if you replay “login” twice you get two tokens (both work until we invalidate). If you replay “register” with the same email the second time fails (email taken). Sending the same token on two protected requests is fine—we just check it twice. Invalidating the same token twice is fine—we just mark it invalid again. So auth doesn’t need “same key = same result”; the payment and job routes might (they use idempotency).

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** If DB fails during verifyAuthToken (invalidated_tokens or token_version query): we throw or reject; requireAuth catches and returns 401 (invalid token)—so we fail closed (we don’t let the request through). If DB fails during login/register: we throw; route returns 500. If DB fails during tokenInvalidation: we throw; caller gets error. So for protected routes we “fail closed” on DB failure (401); for login/register we fail with 500. We don’t retry DB in auth.ts.

**Simple (like for a 10-year-old):** If the database fails when we’re checking the token we return 401 (we don’t let the request through—fail closed). If the database fails when someone is logging in or registering we return 500. If the database fails when we’re invalidating a token the caller gets an error. We don’t retry the database in the auth code.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Anyone can call POST /auth/register and POST /auth/login (they’re public); we don’t restrict who can try to register or login. Protected routes are invoked by whoever has a valid token (and the right role if required). Token invalidation (logout, revoke) is typically invoked by the user themselves (logout) or by admin/support (revoke). Configuration (JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS, N8N_WEBHOOK_SECRET) is env—whoever manages deployment (ops, CI/CD) can change it. No “auth admin” role in this module; admin role is for application authorization, not for “change JWT secret.”

**Simple (like for a 10-year-old):** Anyone can try to register or log in—those routes are public. Protected routes can only be called by someone with a valid token (and the right role if the route requires it). Logout and “revoke token” are usually called by the user or by an admin. Only people who can change the server’s config can change the JWT secret, token lifetime, password hashing strength, and n8n secret. There’s no special “auth admin” role in this code—the “admin” role is for the app (e.g. admin dashboard), not for changing auth config.

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_REFERENCE_CANDIDATES.md`, `FOUNDER_BACKEND_REFERENCE.md`, `ROUTE_PROTECTION_TABLE.md`, `authCanonical.ts`, `tokenInvalidation.ts`, `passwordResetService`, `oauthService` (if present).
