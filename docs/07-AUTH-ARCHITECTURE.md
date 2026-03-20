# 07 — Auth Architecture

> How Better Auth SSO works across OpShield, SafeSpec, and Nexum — including Microsoft SSO, 2FA with device trust, cross-domain sessions, and the migration plan from embedded auth.

## Overview

OpShield runs the **single Better Auth 1.5 instance** for the entire Redbay platform. SafeSpec and Nexum do not run their own auth — they validate tokens issued by OpShield.

```
┌─────────────────────────────────────────────────────────┐
│ OpShield (auth.opshield.com.au)                         │
│                                                          │
│  Better Auth 1.5                                         │
│  ├── Email/password login                                │
│  ├── Microsoft SSO (Azure AD / Entra ID)                 │
│  ├── 2FA (TOTP) with device trust (30-day remember)      │
│  ├── JWT plugin (issues signed access tokens)            │
│  ├── JWKS endpoint (/.well-known/jwks.json)              │
│  └── Session management, password reset, email verify    │
│                                                          │
│  User tables, session tables, account tables             │
│  ALL live in OpShield's database                         │
└────────────┬─────────────────────┬───────────────────────┘
             │                     │
        JWKS │ validation     JWKS │ validation
             │                     │
       ┌─────▼─────┐        ┌─────▼─────┐
       │ SafeSpec   │        │   Nexum   │
       │            │        │           │
       │ Validates  │        │ Validates │
       │ JWT locally│        │ JWT locally│
       │ via JWKS   │        │ via JWKS  │
       └────────────┘        └───────────┘
```

---

## Authentication Methods

### 1. Email/Password

Standard credential-based login:
- User enters email + password on OpShield login page
- Better Auth validates credentials, creates session
- Issues JWT access token
- Redirects to target product with token

### 2. Microsoft SSO (Azure AD / Entra ID)

Tenants can connect their Microsoft environment for single sign-on:

```
User clicks "Sign in with Microsoft"
  → Redirected to Microsoft login
  → Microsoft authenticates, returns to OpShield callback
  → OpShield creates/links account
  → Issues JWT, redirects to product
```

**Configuration in Better Auth:**
```typescript
// OpShield auth configuration
const auth = betterAuth({
  socialProviders: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: 'common', // allows any Microsoft account
      // Per-tenant override possible via SSO plugin
    },
  },
  plugins: [
    sso(), // Enterprise SSO plugin
    // Enables per-tenant Microsoft SSO with their own Azure AD tenant
  ],
});
```

**Per-Tenant Microsoft SSO:**

Large tenants can connect their own Azure AD tenant so their employees authenticate against their company directory:

1. Tenant admin provides their Azure AD tenant ID and app registration details
2. OpShield stores this in the tenant configuration
3. When a user with that tenant's email domain logs in, they're directed to the tenant's Azure AD
4. Better Auth's SSO plugin handles domain-based provider discovery

```
tenant_sso_providers
├── id (UUID)
├── tenant_id → tenants.id
├── provider (text — "microsoft", "google", etc.)
├── provider_tenant_id (text — Azure AD tenant ID)
├── client_id (text — encrypted)
├── client_secret (text — encrypted)
├── domains (text[] — e.g., ["smithhaulage.com.au"])
├── enforce_sso (boolean — if true, email/password disabled for this tenant)
├── status (enum: active, disabled)
├── created_at
└── updated_at
```

**Flow with per-tenant SSO:**
```
1. User enters email: jane@smithhaulage.com.au
2. OpShield checks: does smithhaulage.com.au match any tenant_sso_providers?
3. Yes → redirect to Smith Haulage's Azure AD tenant
4. Microsoft authenticates Jane against their corporate directory
5. OpShield receives callback, creates/links account
6. If enforce_sso = true, Jane cannot use email/password login
```

### 3. Future Providers

The architecture supports adding more SSO providers:
- Google Workspace (for tenants using Google)
- Apple (for mobile users)
- Any SAML 2.0 / OIDC provider via Better Auth's SSO plugin

---

## 2FA — TOTP with Device Trust

### Requirements

- **All users must enable 2FA** — Enforced at the platform level, not optional
- **Device trust** — Once a device is verified, it's remembered for 30 days. Users are NOT prompted for 2FA on every login from a trusted device.
- **Trust refreshes** — Each successful login from a trusted device resets the 30-day timer

### How It Works

```
First login on a new device:
  1. Enter email + password (or Microsoft SSO)
  2. Prompted for TOTP code (from authenticator app)
  3. Enter code with "Trust this device" checked
  4. Device fingerprint stored, trusted for 30 days
  5. JWT issued, redirect to product

Subsequent logins from same device (within 30 days):
  1. Enter email + password (or Microsoft SSO)
  2. Device recognized → skip 2FA
  3. Trust timer reset to 30 days
  4. JWT issued, redirect to product

Login from new/untrusted device:
  1. Enter email + password
  2. 2FA required again
  3. Option to trust this device too
```

### Better Auth 2FA Configuration

```typescript
const auth = betterAuth({
  plugins: [
    twoFactor({
      issuer: 'Redbay',  // Shows in authenticator apps as "Redbay"
      // Device trust is handled per-verification call
    }),
  ],
});

// In the TOTP verification endpoint:
// trustDevice: true stores a device cookie for 30 days
await auth.api.verifyTotp({
  body: { code: userCode, trustDevice: true },
});
```

### 2FA Enforcement

OpShield enforces 2FA for all users. If a user hasn't set up 2FA:

```
1. User logs in successfully (email/password or SSO)
2. OpShield checks: does this user have 2FA enabled?
3. If no → redirect to 2FA setup page (mandatory)
4. User scans QR code with authenticator app
5. Verifies initial code
6. 2FA now active, proceed to product
```

**Supported 2FA methods:**
- TOTP (primary — Google Authenticator, Microsoft Authenticator, Authy, 1Password, etc.)
- Backup codes (generated during setup — 10 one-time codes for recovery)

---

## Cross-Domain Session Architecture

### The Problem

SafeSpec (`app.safespec.com.au`) and Nexum (`app.nexum.com.au`) are on different domains. Browser cookies cannot be shared across different domains. So how does SSO work?

### The Solution: JWT + JWKS

OpShield issues **signed JWT access tokens**. Products validate them **locally** using OpShield's public keys (JWKS), without calling back to OpShield on every request.

```
Login Flow:
  1. User visits app.nexum.com.au
  2. Nexum detects no valid session → redirects to auth.opshield.com.au/login
  3. User authenticates on OpShield (email/password + 2FA, or Microsoft SSO)
  4. OpShield creates session, issues JWT access token
  5. OpShield redirects back to app.nexum.com.au/auth/callback?token=<JWT>
  6. Nexum validates JWT against OpShield's JWKS endpoint
  7. Nexum creates a local session cookie (its own domain)
  8. User is logged in to Nexum

Cross-Product Navigation:
  1. User is in Nexum, clicks "SafeSpec" link
  2. Browser opens app.safespec.com.au
  3. SafeSpec detects no local session → redirects to auth.opshield.com.au/login
  4. OpShield detects existing session (OpShield domain cookie) → skip login
  5. OpShield issues new JWT for SafeSpec
  6. Redirect back to SafeSpec with JWT → local session created
  7. User is in SafeSpec — no re-login required (SSO)
```

### JWT Token Structure

```json
{
  "sub": "user-uuid",
  "email": "jane@smithhaulage.com.au",
  "name": "Jane Smith",
  "tenant_memberships": [
    {
      "tenant_id": "tenant-uuid",
      "role": "owner",
      "products": ["nexum", "safespec"]
    }
  ],
  "aud": "nexum",           // Which product this token is for
  "iss": "opshield",        // Issued by OpShield
  "iat": 1711929600,        // Issued at
  "exp": 1711933200         // Expires (1 hour)
}
```

### Product-Side Token Validation

Products validate JWTs using the `jose` library and OpShield's JWKS endpoint:

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Fetch and cache OpShield's public keys
const JWKS = createRemoteJWKSet(
  new URL(`${OPSHIELD_AUTH_URL}/.well-known/jwks.json`)
);

// Validate token on each request
const validateToken = async (token: string, expectedAudience: string) => {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'opshield',
    audience: expectedAudience, // "nexum" or "safespec"
  });
  return payload; // { sub, email, name, tenant_memberships, ... }
};
```

**Key properties:**
- **Stateless validation** — Products don't call OpShield per request. They verify the JWT signature locally using cached public keys.
- **Audience scoping** — A token issued for Nexum cannot be used in SafeSpec (different `aud` claim).
- **Short-lived tokens** — JWTs expire after 1 hour. Products issue their own session cookies for longer sessions.
- **JWKS caching** — Products cache the public key set. If a token has an unknown `kid`, they refetch the JWKS.

### Product Session Management

After validating the JWT from OpShield, each product creates its own session:

```
1. JWT received and validated
2. Product looks up user in its own tenant context
3. Product creates a local session (httpOnly cookie, own domain)
4. Local session TTL: 7 days (configurable)
5. On expiry: redirect to OpShield for re-auth (likely instant if OpShield session is alive)
```

### Logout

```
Local logout (product only):
  User clicks "Logout" in Nexum
  → Nexum clears its local session cookie
  → User is logged out of Nexum only
  → SafeSpec session remains active

Global logout (all products):
  User clicks "Logout everywhere" in account settings (OpShield)
  → OpShield revokes the session
  → OpShield sends webhook to all products: session.revoked
  → Products invalidate any sessions for that user
  → User is logged out everywhere
```

---

## Migration Plan: Extracting Auth from SafeSpec/Nexum

Both SafeSpec and Nexum currently have embedded Better Auth instances with their own user/session tables. These must be migrated to OpShield.

### Phase 1: Build OpShield Auth (no migration yet)

1. Set up Better Auth in OpShield with:
   - Email/password provider
   - Microsoft SSO provider
   - 2FA plugin with device trust
   - JWT plugin with JWKS endpoint
2. Create OpShield's `user`, `session`, `account`, `verification`, `two_factor` tables
3. Build login page, 2FA setup page, callback endpoints
4. Test the full flow: login → JWT → product callback → local session

### Phase 2: Dual-Auth Transition Period

During migration, products support BOTH their embedded auth AND OpShield auth:

```
Request arrives at SafeSpec:
  1. Check for local session cookie → if valid, proceed (embedded auth)
  2. Check for OpShield JWT in query/header → if valid, create local session
  3. Neither → redirect to OpShield login (new default)
```

This allows gradual migration:
- New sign-ups go through OpShield
- Existing users continue with embedded auth
- Existing users can "link" to OpShield by logging in once via OpShield

### Phase 3: User Migration

Migrate existing users from product databases to OpShield:

```sql
-- For each existing user in SafeSpec/Nexum:
-- 1. Create user in OpShield (if not already exists by email)
-- 2. Link existing product sessions to OpShield user
-- 3. Preserve 2FA setup (TOTP secret) if already configured
-- 4. Create tenant_users mapping in OpShield

INSERT INTO opshield.user (id, email, name, email_verified, ...)
SELECT id, email, name, email_verified, ...
FROM safespec.user
ON CONFLICT (email) DO UPDATE SET ...;
```

**Critical: Preserve user IDs** — Use the same UUIDs in OpShield as in the products. This avoids needing to update every foreign key reference.

### Phase 4: Cut Over

1. Remove embedded Better Auth from SafeSpec and Nexum
2. Drop auth tables from product databases (after backup)
3. Products now exclusively validate via OpShield JWKS
4. All login flows go through OpShield

### Phase 5: Cleanup

1. Remove Better Auth dependencies from product `package.json`
2. Remove auth route handlers from products
3. Update product middleware to only accept OpShield JWTs
4. Update tests

### Migration Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| User can't log in during migration | Dual-auth mode — both paths work simultaneously |
| 2FA secrets lost | Copy TOTP secrets from product DB to OpShield DB |
| Password hashes incompatible | Better Auth uses bcrypt everywhere — hashes are portable |
| Session disruption | Existing sessions continue working until natural expiry |
| Rollback needed | Keep product auth tables for 30 days after cutover |

---

## Database Tables (in OpShield)

Better Auth manages these tables automatically:

```
user
├── id (UUID — preserved from product migration)
├── email (text, unique)
├── name (text)
├── email_verified (boolean)
├── image (text, nullable — avatar URL)
├── created_at
└── updated_at

session
├── id (UUID)
├── user_id → user.id
├── token (text — session token)
├── expires_at (timestamp)
├── ip_address (text, nullable)
├── user_agent (text, nullable)
├── created_at
└── updated_at

account
├── id (UUID)
├── user_id → user.id
├── provider (text — "credential", "microsoft")
├── provider_account_id (text)
├── access_token (text, nullable)
├── refresh_token (text, nullable)
├── expires_at (timestamp, nullable)
├── created_at
└── updated_at

verification
├── id (UUID)
├── identifier (text — email address)
├── value (text — token)
├── expires_at (timestamp)
├── created_at
└── updated_at

two_factor
├── id (UUID)
├── user_id → user.id
├── secret (text — encrypted TOTP secret)
├── backup_codes (text — encrypted, comma-separated)
├── created_at
└── updated_at

-- Custom table for per-tenant SSO
tenant_sso_providers
├── (see schema above in Microsoft SSO section)
```

---

## Environment Variables

### OpShield

```env
# Better Auth
BETTER_AUTH_SECRET=<random-32-char-secret>
BETTER_AUTH_URL=https://auth.opshield.com.au

# Microsoft SSO (global/default)
MICROSOFT_CLIENT_ID=<azure-app-client-id>
MICROSOFT_CLIENT_SECRET=<azure-app-client-secret>

# JWT signing
JWT_PRIVATE_KEY=<RSA-private-key-PEM>    # Or auto-generated by Better Auth
JWT_PUBLIC_KEY=<RSA-public-key-PEM>

# Product callback URLs (for redirect after login)
NEXUM_CALLBACK_URL=https://app.nexum.com.au/auth/callback
SAFESPEC_CALLBACK_URL=https://app.safespec.com.au/auth/callback
```

### SafeSpec / Nexum

```env
# OpShield auth (replaces embedded Better Auth config)
OPSHIELD_AUTH_URL=https://auth.opshield.com.au
OPSHIELD_JWKS_URL=https://auth.opshield.com.au/.well-known/jwks.json
OPSHIELD_LOGIN_URL=https://auth.opshield.com.au/login
PRODUCT_AUDIENCE=safespec  # or "nexum" — for JWT aud validation
```

---

## Security Considerations

- **JWT tokens are short-lived** (1 hour) — limits exposure if intercepted
- **JWKS keys are rotated periodically** — products refetch on unknown `kid`
- **2FA is mandatory** — no user can access any product without 2FA enabled
- **Device trust cookies are httpOnly, secure, sameSite=strict** — not accessible to JavaScript
- **Microsoft SSO tokens are never stored in OpShield** — only the account link is stored
- **Per-tenant SSO secrets are encrypted at rest** — using application-level encryption
- **Callback URLs are allowlisted** — OpShield only redirects to known product URLs
- **CSRF protection** — Better Auth includes CSRF tokens on all state-changing endpoints
