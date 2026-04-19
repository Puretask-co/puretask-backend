# Advanced Authentication Features - Complete Implementation Guide

## 🎉 Overview

Your PureTask backend now includes **enterprise-grade authentication features**:

- ✅ **Email Verification** - Confirm user email addresses
- ✅ **Password Reset** - Secure forgot password flow
- ✅ **Two-Factor Authentication (2FA)** - TOTP (Authenticator Apps) + SMS
- ✅ **Session Management** - Track and revoke JWT sessions
- ✅ **OAuth Login** - Google & Facebook authentication
- ✅ **Security Audit Logging** - Track all security events
- ✅ **Account Lockout** - Prevent brute force attacks
- ✅ **Trusted Devices** - Remember devices for 2FA

---

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [Email Verification](#email-verification)
3. [Password Reset](#password-reset)
4. [Two-Factor Authentication](#two-factor-authentication)
5. [Session Management](#session-management)
6. [OAuth Authentication](#oauth-authentication)
7. [API Endpoints](#api-endpoints)
8. [Configuration](#configuration)
9. [Security Best Practices](#security-best-practices)
10. [Testing](#testing)

---

## 🗄️ Database Schema

### New Tables Created

Run the migration:
```bash
psql $DATABASE_URL < DB/migrations/025_auth_enhancements.sql
```

**Tables Added:**
- `user_sessions` - JWT session tracking
- `oauth_accounts` - OAuth provider accounts
- `two_factor_codes` - SMS 2FA verification codes
- `security_events` - Security audit log
- `login_attempts` - Track failed logins
- `email_change_requests` - Pending email changes
- `trusted_devices` - Skip 2FA for trusted devices

**Users Table Enhanced:**
- Email verification fields
- Password reset fields
- 2FA configuration
- Account lockout tracking
- Last login tracking

---

## 📧 Email Verification

### Flow

1. User registers → Email sent automatically
2. User clicks verification link with token
3. Email marked as verified

### API Endpoints

#### Send Verification Email
```http
POST /auth/send-verification
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

#### Verify Email
```http
POST /auth/verify-email
Content-Type: application/json

{
  "token": "abc123..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### Code Example

```typescript
import { sendVerificationEmail, verifyEmail } from "./services/emailVerificationService";

// Send verification
await sendVerificationEmail(userId, userEmail);

// Verify
const result = await verifyEmail(token);
if (result.success) {
  console.log("Email verified!");
}
```

---

## 🔑 Password Reset

### Flow

1. User requests password reset (enters email)
2. Reset link sent to email (1-hour expiry)
3. User clicks link, enters new password
4. All sessions revoked (forced re-login)

### API Endpoints

#### Request Password Reset
```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If that email exists, a password reset link has been sent"
}
```

> **Note:** Always returns success to prevent email enumeration

#### Verify Reset Token
```http
POST /auth/verify-reset-token
Content-Type: application/json

{
  "token": "abc123..."
}
```

**Response:**
```json
{
  "valid": true,
  "userId": "user-id-here"
}
```

#### Reset Password
```http
POST /auth/reset-password
Content-Type: application/json

{
  "token": "abc123...",
  "newPassword": "newsecurepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## 🔐 Two-Factor Authentication

### Supported Methods

1. **TOTP** (Time-based One-Time Password) - Google Authenticator, Authy, 1Password
2. **SMS** - Text message verification codes

### TOTP (Authenticator App) Setup Flow

#### 1. Enable TOTP
```http
POST /auth/2fa/enable-totp
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": [
    "A1B2C3D4",
    "E5F6G7H8",
    ...
  ],
  "message": "Scan the QR code with your authenticator app"
}
```

#### 2. Verify TOTP Code
```http
POST /auth/2fa/verify-totp
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

### SMS 2FA Setup Flow

#### 1. Enable SMS 2FA
```http
POST /auth/2fa/enable-sms
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "+12345678900"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent to your phone"
}
```

#### 2. Verify SMS Code
```http
POST /auth/2fa/verify-sms
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

### Login with 2FA

When user has 2FA enabled:

1. **Step 1:** Regular login (email + password)
2. **Step 2:** Verify 2FA code

```http
POST /auth/2fa/verify
Content-Type: application/json

{
  "userId": "user-id",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "method": "totp"
}
```

### Backup Codes

Users receive 10 backup codes (one-time use) when enabling 2FA.

#### Regenerate Backup Codes
```http
POST /auth/2fa/regenerate-backup-codes
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "backupCodes": ["A1B2C3D4", ...],
  "message": "New backup codes generated. Store them safely!"
}
```

### Disable 2FA
```http
POST /auth/2fa/disable
Authorization: Bearer <token>
Content-Type: application/json

{
  "password": "userpassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Two-factor authentication disabled"
}
```

---

## 📱 Session Management

Track all active JWT sessions and revoke them individually or all at once.

### Get Active Sessions
```http
GET /auth/sessions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "session-id-1",
      "device_info": {
        "browser": "Chrome",
        "os": "Windows",
        "device": "desktop"
      },
      "ip_address": "192.168.1.1",
      "last_activity_at": "2025-12-27T...",
      "created_at": "2025-12-27T..."
    }
  ]
}
```

### Get Session Statistics
```http
GET /auth/sessions/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "activeSessions": 3,
  "totalSessions": 15,
  "lastLogin": "2025-12-27T...",
  "devices": [
    {
      "device": "Desktop - Windows 10",
      "lastUsed": "2025-12-27T..."
    }
  ]
}
```

### Revoke Specific Session
```http
DELETE /auth/sessions/{sessionId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Session revoked"
}
```

### Logout from All Devices
```http
POST /auth/logout-all
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out from 3 device(s)"
}
```

---

## 🔗 OAuth Authentication

### Supported Providers

- Google
- Facebook
- Apple (ready for implementation)
- GitHub (ready for implementation)

### Configuration

Add to `.env`:
```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/oauth/google/callback

# Facebook OAuth
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_REDIRECT_URI=http://localhost:4000/auth/oauth/facebook/callback
```

### Get Linked OAuth Accounts
```http
GET /auth/oauth/accounts
Authorization: Bearer <token>
```

**Response:**
```json
{
  "accounts": [
    {
      "id": "account-id",
      "provider": "google",
      "providerEmail": "user@gmail.com",
      "linkedAt": "2025-12-27T..."
    }
  ]
}
```

### Unlink OAuth Account
```http
DELETE /auth/oauth/{provider}
Authorization: Bearer <token>
```

**Example:**
```http
DELETE /auth/oauth/google
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "OAuth account unlinked"
}
```

### Set Password for OAuth-Only Users
```http
POST /auth/oauth/set-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "password": "newsecurepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password set successfully"
}
```

---

## 🛣️ API Endpoints Summary

### Email Verification
- `POST /auth/send-verification` - Send verification email
- `POST /auth/verify-email` - Verify email with token
- `POST /auth/request-email-change` - Request email change
- `POST /auth/verify-email-change` - Verify new email

### Password Reset
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/verify-reset-token` - Check if token is valid
- `POST /auth/reset-password` - Reset password with token

### Two-Factor Authentication
- `POST /auth/2fa/enable-totp` - Setup TOTP 2FA
- `POST /auth/2fa/verify-totp` - Verify and enable TOTP
- `POST /auth/2fa/enable-sms` - Setup SMS 2FA
- `POST /auth/2fa/send-sms-code` - Resend SMS code
- `POST /auth/2fa/verify-sms` - Verify and enable SMS
- `POST /auth/2fa/verify` - Verify 2FA code during login
- `POST /auth/2fa/disable` - Disable 2FA
- `GET /auth/2fa/status` - Get 2FA status
- `POST /auth/2fa/regenerate-backup-codes` - Get new backup codes

### Session Management
- `GET /auth/sessions` - Get active sessions
- `GET /auth/sessions/stats` - Get session statistics
- `DELETE /auth/sessions/:id` - Revoke specific session
- `POST /auth/logout-all` - Logout from all devices

### OAuth
- `GET /auth/oauth/accounts` - Get linked accounts
- `DELETE /auth/oauth/:provider` - Unlink OAuth account
- `POST /auth/oauth/set-password` - Set password for OAuth users
- `GET /auth/oauth/can-set-password` - Check if can set password

---

## ⚙️ Configuration

### Environment Variables

Add to `.env`:

```bash
# Email (SendGrid)
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=no-reply@puretask.com
SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION=d-xxx
SENDGRID_TEMPLATE_USER_PASSWORD_RESET=d-xxx

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_FROM_NUMBER=+12345678900

# OAuth - Google
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/oauth/google/callback

# OAuth - Facebook
FACEBOOK_APP_ID=xxx
FACEBOOK_APP_SECRET=xxx
FACEBOOK_REDIRECT_URI=http://localhost:4000/auth/oauth/facebook/callback

# Application URLs
APP_URL=http://localhost:3000
```

---

## 🔒 Security Best Practices

### Password Security
- ✅ Minimum 8 characters enforced
- ✅ Bcrypt hashing (10 rounds)
- ✅ Password history tracking
- ✅ Prevent password reuse

### Account Lockout
- ✅ Locks after 5 failed login attempts
- ✅ 15-minute lockout duration
- ✅ Clears on successful login

### Token Security
- ✅ Email verification: 24-hour expiry
- ✅ Password reset: 1-hour expiry
- ✅ 2FA SMS codes: 10-minute expiry
- ✅ JWT sessions: 30-day expiry (configurable)

### Rate Limiting
- ✅ Auth endpoints have stricter limits
- ✅ Failed login tracking per IP
- ✅ SMS code sending rate limited

### Audit Logging
All security events logged:
- Login attempts (success/failed)
- Password changes/resets
- Email verification
- 2FA enabled/disabled
- Session revocations
- OAuth linking/unlinking

Query security events:
```sql
SELECT * FROM security_events 
WHERE user_id = 'user-id' 
ORDER BY created_at DESC 
LIMIT 50;
```

---

## 🧪 Testing

### Test Email Verification

```bash
curl -X POST http://localhost:4000/auth/send-verification \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Test Password Reset

```bash
curl -X POST http://localhost:4000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Test 2FA Setup

```bash
# Enable TOTP
curl -X POST http://localhost:4000/auth/2fa/enable-totp \
  -H "Authorization: Bearer YOUR_TOKEN"

# Verify with code from authenticator app
curl -X POST http://localhost:4000/auth/2fa/verify-totp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

### Test Session Management

```bash
# Get active sessions
curl -X GET http://localhost:4000/auth/sessions \
  -H "Authorization: Bearer YOUR_TOKEN"

# Logout from all devices
curl -X POST http://localhost:4000/auth/logout-all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📦 Dependencies Added

```json
{
  "speakeasy": "^2.0.0",
  "qrcode": "^1.5.0",
  "ua-parser-js": "^1.0.0",
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "passport-facebook": "^3.0.0"
}
```

---

## 🚀 Deployment Checklist

### Before Production

- [ ] Run database migration `025_auth_enhancements.sql`
- [ ] Set strong `JWT_SECRET` (128+ characters)
- [ ] Configure SendGrid templates
- [ ] Configure Twilio account
- [ ] Set up Google OAuth app
- [ ] Set up Facebook OAuth app
- [ ] Test email delivery
- [ ] Test SMS delivery
- [ ] Test 2FA flow
- [ ] Test session management
- [ ] Review security event logs

### Production Environment Variables

```bash
# Required for email verification & password reset
SENDGRID_API_KEY=SG.production_key
SENDGRID_FROM_EMAIL=no-reply@puretask.com

# Required for SMS 2FA
TWILIO_ACCOUNT_SID=AC_production
TWILIO_AUTH_TOKEN=production_token
TWILIO_FROM_NUMBER=+1234567890

# Required for OAuth
GOOGLE_CLIENT_ID=prod_client_id
GOOGLE_CLIENT_SECRET=prod_secret
FACEBOOK_APP_ID=prod_app_id
FACEBOOK_APP_SECRET=prod_secret

# Application URL
APP_URL=https://app.puretask.com
```

---

## 📝 Database Cleanup

Expired tokens are auto-cleaned. To manually clean:

```sql
-- Clean expired tokens
SELECT cleanup_expired_auth_tokens();

-- Clean old sessions (30+ days expired)
DELETE FROM user_sessions 
WHERE expires_at < NOW() 
AND created_at < NOW() - INTERVAL '30 days';

-- Clean old login attempts (7+ days)
DELETE FROM login_attempts 
WHERE created_at < NOW() - INTERVAL '7 days';
```

---

## 🎯 Next Steps

Your authentication system is now **production-ready** with enterprise features!

### Optional Enhancements

1. **WebAuthn/Passkeys** - Passwordless authentication
2. **Magic Links** - Email-based passwordless login
3. **Device Recognition** - Remember trusted devices
4. **Geolocation Blocking** - Block logins from specific regions
5. **Advanced Fraud Detection** - ML-based suspicious activity detection

---

## 📚 Additional Resources

- **JWT Best Practices**: https://jwt.io/introduction
- **TOTP Spec (RFC 6238)**: https://tools.ietf.org/html/rfc6238
- **OAuth 2.0**: https://oauth.net/2/
- **OWASP Auth Cheatsheet**: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

---

**Last Updated:** December 27, 2025  
**Status:** ✅ Production Ready  
**Version:** 1.0.0


