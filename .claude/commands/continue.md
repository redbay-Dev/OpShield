Resume development from where the last session left off. This command must give the user a COMPLETE and HONEST picture of project status — not a rosy summary.

## Steps

### 1. Assess Current State
- Read `CHANGELOG.md` — what was done recently, what was flagged as next
- Read `docs/DECISION-LOG.md` — recent decisions
- Run `git log --oneline -20` — recent commits
- Run `git status` and `git diff` — uncommitted work

### 2. Assess FULL Project Completion (CRITICAL)
Compare what exists in the codebase against ALL spec docs. Read each doc and check what's actually implemented vs what's missing:

**Foundation:**
- `docs/00-PROJECT-OVERVIEW.md` — overall platform vision

**What OpShield Owns:**
1. **Auth (SSO)** — Single Better Auth instance, session management, all products validate against this
2. **Tenant Provisioning** — Tenant creation, schema creation in product databases, tenant settings
3. **Billing (Stripe)** — Subscriptions, plans, usage tracking, invoicing, webhook handling
4. **Public Website** — Marketing pages, pricing, sign-up flow, login with redirect
5. **Platform Admin** — Redbay staff dashboard for managing tenants, users, billing, system health

For each area, assess honestly:
- **Not started** — no code exists
- **Scaffolded** — basic structure exists but no real business logic
- **Partially complete** — some sub-features work but key parts missing
- **Complete** — all sub-features work as specified, with tests

### 3. Identify Half-Built Features
Look specifically for features that were "implemented" but are actually just:
- Thin CRUD without the business logic
- Missing integration between features (e.g., provisioning not wiring up product databases)
- Missing validation rules, calculations, or automation
- Missing tests (unit tests for logic, integration tests for API routes)

### 4. Report to User
Present a clear, honest summary:

**Last session:** What was done (from CHANGELOG.md)

**Overall project completion:**
- Phase 1 (Scaffold): status
- Phase 2 (Database Foundation): status
- Phase 3 (Auth & Better Auth): status
- Tenant Provisioning: status
- Billing (Stripe): status
- Public Website: status
- Platform Admin: status

**Half-built features that need finishing:**
- List features that exist but aren't production-ready

**Recommended next priority:**
- Focus on DEEPENING existing features before adding new thin slices

### 5. Ask the User
Ask what they want to focus on, but suggest a specific plan based on the assessment. Default suggestion should be to FINISH incomplete features rather than start new ones.
