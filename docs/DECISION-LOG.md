# Decision Log

Every architectural, product, and workflow decision is recorded here with rationale. Agents do not have memory between sessions — this log is how continuity is maintained.

---

## Format

```
### DEC-XXX: [Short title]
**Date:** YYYY-MM-DD
**Context:** Why this decision was needed
**Decision:** What was decided
**Rationale:** Why this option was chosen
**Alternatives considered:** What else was considered and why it was rejected
```

---

### DEC-001: OpShield as the central platform layer
**Date:** 2026-03-20
**Context:** Nexum (operations) and SafeSpec (compliance) are independent products that can be sold separately or bundled. Both currently embed their own Better Auth instances and tenant provisioning. A central platform is needed for unified auth, billing, provisioning, and management.
**Decision:** Create OpShield as a third project that owns authentication (single Better Auth SSO instance), tenant provisioning (creates schemas in product databases), billing (Stripe), public website (marketing/sign-up), and platform admin (Redbay staff dashboard). Products delegate auth to OpShield but retain their own business logic, databases, roles, and permissions.
**Rationale:** Extracting auth and billing to a platform layer avoids duplicating provisioning logic across products, enables true SSO, supports independent or bundled sales, and centralises Stripe billing. This is the standard multi-product SaaS pattern (Atlassian, Zoho, MYOB).
**Alternatives considered:** Keep auth embedded in each product (duplicate accounts); shared database between products (creates coupling); OpShield as API gateway (adds latency and single point of failure).

### DEC-002: Same tech stack as Nexum/SafeSpec
**Date:** 2026-03-20
**Context:** OpShield needs a tech stack. The team already knows Fastify + React + Drizzle + shadcn/ui from building Nexum and SafeSpec.
**Decision:** Use identical stack: React 19, Fastify 5, TypeScript 5.9, Drizzle ORM, Tailwind CSS 4, shadcn/ui, pnpm + Turborepo, Vitest, Playwright.
**Rationale:** Developer consistency. One person (Ryan + Claude) maintains all three projects. Different stacks would increase cognitive load and maintenance burden for zero benefit.
**Alternatives considered:** Next.js for the public website (SSR benefits for marketing pages, but adds a different framework to learn and maintain).

### DEC-003: Flat database schema (no multi-tenancy in OpShield)
**Date:** 2026-03-20
**Context:** Nexum and SafeSpec use schema-per-tenant. OpShield manages tenants — should it also be multi-tenant?
**Decision:** OpShield uses a flat/single schema. It is the tenant registry, not a tenant itself.
**Rationale:** OpShield has one "tenant" — Redbay. There's no scenario where OpShield itself needs multi-tenancy. The tenants table in OpShield represents customers across all products.
**Alternatives considered:** None — this is straightforward.

### DEC-004: API port 3000, frontend port 5170
**Date:** 2026-03-20
**Context:** SafeSpec uses 3001/5173, Nexum uses 3002/5174. Need non-conflicting ports.
**Decision:** OpShield API on 3000, frontend on 5170. Redis prefix `opshield:`, database `opshield_dev`.
**Rationale:** Port 3000 is the natural "platform" port. Frontend 5170 precedes both product frontends.
**Alternatives considered:** None — sequential numbering.

---
