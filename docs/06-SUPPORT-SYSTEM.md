# 06 — Support System

> Centralized support hub for all Redbay products. Tenants submit tickets from any product, OpShield manages the lifecycle.

## Overview

OpShield is the **single support hub** for the entire Redbay platform. Users can submit support requests from within SafeSpec or Nexum — the request is routed to OpShield where it's managed, tracked, and responded to. This keeps support tooling out of the product codebases and gives Redbay staff one place to handle everything.

```
┌────────────┐  ┌────────────┐
│  SafeSpec   │  │   Nexum    │
│             │  │            │
│ [? Help]    │  │ [? Help]   │
│  ↓ email    │  │  ↓ email   │
│  ↓ or API   │  │  ↓ or API  │
└──────┬──────┘  └──────┬─────┘
       │                │
       ▼                ▼
┌─────────────────────────────┐
│         OpShield            │
│                             │
│  ┌───────────────────────┐  │
│  │   Support System      │  │
│  │                       │  │
│  │  Inbound email        │  │
│  │  Ticket management    │  │
│  │  Response & history   │  │
│  │  Tenant context       │  │
│  │  SLA tracking         │  │
│  └───────────────────────┘  │
│                             │
│  Platform Admin Dashboard   │
└─────────────────────────────┘
```

---

## How It Works

### 1. Tenant Submits a Support Request

From within any product (SafeSpec or Nexum), the user clicks a help/support button. This opens a simple form:

```
┌──────────────────────────────────────────────┐
│ Contact Support                              │
│                                              │
│ Subject: [________________________]          │
│                                              │
│ Category: [Bug Report        ▼]              │
│           Bug Report                         │
│           Feature Request                    │
│           Billing Question                   │
│           How Do I...?                       │
│           Account Issue                      │
│           Other                              │
│                                              │
│ Description:                                 │
│ ┌──────────────────────────────────────────┐ │
│ │                                          │ │
│ │                                          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Attachments: [+ Add files] (screenshots etc) │
│                                              │
│ [Submit]                                     │
└──────────────────────────────────────────────┘
```

The product sends this to OpShield via **email** (primary) or **API** (fallback):

**Email method (primary):**
- Product sends an email to `support@redbay.com.au` (or `support@opshield.com.au`)
- Email includes structured headers for automatic parsing:
  - `X-Redbay-Product: safespec`
  - `X-Redbay-Tenant-Id: uuid`
  - `X-Redbay-User-Id: uuid`
  - `X-Redbay-Category: bug_report`
  - `X-Redbay-Page: /hazards/123`
- OpShield's inbound email processor creates a ticket automatically

**API method (fallback/real-time):**
```
POST {OPSHIELD_API_URL}/api/support/tickets
Headers:
  X-Product-Api-Key: <product-key>
Body:
{
  "product_id": "safespec",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "user_email": "jane@smithhaulage.com.au",
  "user_name": "Jane Smith",
  "category": "bug_report",
  "subject": "SWMS builder not saving hazard steps",
  "description": "When I add a hazard step and click save...",
  "page_url": "/swms/456/edit",
  "attachments": [],
  "browser_info": { "ua": "...", "screen": "1920x1080" }
}
```

### 2. OpShield Processes the Ticket

When a ticket arrives (via email or API):

1. **Parse and enrich** — Extract tenant context, subscription details, user role
2. **Create ticket record** in OpShield database
3. **Auto-categorize** — Route billing questions to billing queue, product bugs to product queue
4. **Assign priority** — Based on tenant plan tier (Enterprise = high, Starter = normal)
5. **Send acknowledgment** — Reply email to user confirming receipt with ticket number
6. **Notify admin** — Push notification / email to Redbay support staff

### 3. Admin Manages via Platform Admin Dashboard

Support tickets appear in the Platform Admin under a dedicated Support section:

```
┌─────────────────────────────────────────────────────────────────┐
│ Support Tickets (12 open)              [Filters ▼] [Export]     │
│                                                                  │
│ Priority │ #     │ Subject              │ Product │ Tenant      │ Status   │ Age    │
│ ─────────┼───────┼──────────────────────┼─────────┼─────────────┼──────────┼─────── │
│ 🔴 High  │ T-089 │ Can't generate PDF   │ SS-WHS  │ BridgeCo   │ Open     │ 2h     │
│ 🟡 Med   │ T-088 │ Invoice shows wrong  │ Nexum   │ Smith Haul │ In Prog  │ 5h     │
│ 🟢 Low   │ T-087 │ How to add a SWMS    │ SS-WHS  │ Metro Earth│ Open     │ 1d     │
│ 🟡 Med   │ T-086 │ Billing question     │ OpShield│ Pacific Log│ Waiting  │ 2d     │
│ 🟢 Low   │ T-085 │ Feature request: map │ Nexum   │ Outback Tr │ Open     │ 3d     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

#### Ticket Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│ Ticket #T-089                                    Priority: High │
│ Subject: Can't generate PDF for SWMS                            │
│                                                                  │
│ ┌─── Context ───────────────────────────────────────────────┐   │
│ │ Product: SafeSpec (WHS Module)                             │  │
│ │ Tenant: BridgeCo Civil Pty Ltd (Growth plan, active)       │  │
│ │ User: Jane Smith (admin) — jane@bridgeco.com.au            │  │
│ │ Page: /swms/456/edit                                       │  │
│ │ Submitted: 2026-03-20 08:15 AEST                           │  │
│ │ [View Tenant] [Impersonate Tenant] [Open Page in SafeSpec] │  │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─── Conversation ──────────────────────────────────────────┐   │
│ │                                                            │   │
│ │ Jane Smith (customer) — 08:15                              │   │
│ │ When I click "Generate PDF" on the SWMS builder, it spins  │   │
│ │ for about 30 seconds then shows "Generation failed". This  │   │
│ │ has been happening since yesterday. Screenshot attached.    │   │
│ │ [screenshot.png]                                           │   │
│ │                                                            │   │
│ │ Ryan (admin) — 08:45                                       │   │
│ │ Hi Jane, I can see the issue — the PDF service had a       │   │
│ │ memory spike yesterday. I've restarted it and your SWMS    │   │
│ │ should generate fine now. Could you try again?             │   │
│ │                                                            │   │
│ │ Jane Smith (customer) — 09:02                              │   │
│ │ That worked! Thanks for the quick fix.                     │   │
│ │                                                            │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─── Reply ─────────────────────────────────────────────────┐   │
│ │ [                                                    ]     │   │
│ │ [                                                    ]     │   │
│ │                                                            │   │
│ │ [Send Reply]  [Add Internal Note]  [Close Ticket]          │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ Status: [In Progress ▼]  Assign: [Ryan ▼]                       │
│ Tags: [pdf] [swms] [+ Add tag]                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Responses Go Back via Email

When an admin replies to a ticket:
1. OpShield sends the reply as an email to the user
2. The user can reply to that email — OpShield's inbound processor appends it to the ticket thread
3. The conversation continues via email, but the admin always works from the dashboard

This means users **never need to log into OpShield for support** — it's all email from their perspective.

---

## Database Schema

### `support_tickets`

```
support_tickets
├── id (UUID)
├── ticket_number (text — "T-089", auto-incrementing, human-readable)
├── product_id (text — "safespec", "nexum", "opshield")
├── tenant_id → tenants.id
├── user_id → user.id (the submitter)
├── user_email (text — for email threading)
├── user_name (text)
├── category (enum: bug_report, feature_request, billing, how_to, account, other)
├── subject (text)
├── description (text)
├── page_url (text, nullable — where in the product the issue occurred)
├── browser_info (JSONB, nullable)
├── priority (enum: low, medium, high, urgent)
├── status (enum: open, in_progress, waiting_on_customer, waiting_on_internal, resolved, closed)
├── assigned_to → platform_admins.id (nullable)
├── tags (text[])
├── email_thread_id (text — for email threading/grouping)
├── resolved_at (timestamp, nullable)
├── closed_at (timestamp, nullable)
├── first_response_at (timestamp, nullable — for SLA tracking)
├── created_at
├── updated_at
└── deleted_at (soft delete)
```

### `support_messages`

```
support_messages
├── id (UUID)
├── ticket_id → support_tickets.id
├── sender_type (enum: customer, admin, system)
├── sender_id (UUID — user_id or platform_admin_id)
├── sender_name (text)
├── sender_email (text)
├── body (text — the message content)
├── body_html (text, nullable — if email had HTML)
├── is_internal_note (boolean — visible to admins only, not sent to customer)
├── email_message_id (text, nullable — for email deduplication)
├── created_at
└── (immutable — no updates or deletes)
```

### `support_attachments`

```
support_attachments
├── id (UUID)
├── ticket_id → support_tickets.id
├── message_id → support_messages.id (nullable)
├── file_name (text)
├── file_size (integer — bytes)
├── mime_type (text)
├── storage_key (text — MinIO/S3 key)
├── uploaded_by (UUID)
├── created_at
└── (immutable)
```

---

## Email Architecture

### Inbound Email Processing

OpShield processes inbound emails to create and update tickets:

```
Inbound email → SMTP endpoint (or webhook from email provider)
  │
  ├── New email (no thread ID match)?
  │   └── Create new support_ticket + first support_message
  │
  └── Reply to existing thread?
      └── Append support_message to existing ticket
          └── If ticket was "resolved" or "waiting_on_customer" → reopen to "open"
```

**Email provider options:**
- **SMTP2GO** (already used for outbound) — check if they support inbound routing/webhooks
- **Mailgun** or **Postmark** — both have inbound email parsing APIs
- **Custom SMTP receiver** — more control but more infrastructure

**Recommended: Use the same provider for inbound and outbound** to keep infrastructure simple.

### Outbound Email

When admin replies to a ticket:

```
From: Redbay Support <support@redbay.com.au>
To: jane@bridgeco.com.au
Subject: Re: [T-089] Can't generate PDF for SWMS
Reply-To: support+T-089@redbay.com.au (for threading)
References: <original-message-id>
In-Reply-To: <original-message-id>

Hi Jane,

I can see the issue — the PDF service had a memory spike yesterday...

---
Redbay Support
Ticket #T-089 | SafeSpec WHS
To view your support history, visit: https://app.opshield.com.au/support
```

### Email Threading

Replies are threaded using:
1. **Reply-To address**: `support+{ticket_number}@redbay.com.au` (plus-addressing)
2. **Email headers**: `In-Reply-To` and `References` for proper email client threading
3. **Fallback**: Subject line parsing for `[T-089]` pattern

---

## Product-Side Integration

Each product needs a minimal support UI — just the submission form and a ticket history view.

### Support Widget (in SafeSpec and Nexum)

A help button in the app shell (bottom-right or sidebar):

```typescript
// Minimal support component in each product
const SupportWidget = () => {
  const { user, tenant } = useAuth();
  const currentPath = useLocation().pathname;

  const submitTicket = async (data: SupportFormData) => {
    // Option 1: Send email via product's email service
    await sendSupportEmail({
      to: 'support@redbay.com.au',
      subject: data.subject,
      body: data.description,
      headers: {
        'X-Redbay-Product': 'safespec',
        'X-Redbay-Tenant-Id': tenant.id,
        'X-Redbay-User-Id': user.id,
        'X-Redbay-Category': data.category,
        'X-Redbay-Page': currentPath,
      },
      attachments: data.files,
    });

    // Option 2: Call OpShield API directly
    await fetch(`${OPSHIELD_API_URL}/api/support/tickets`, {
      method: 'POST',
      headers: { 'X-Product-Api-Key': OPSHIELD_API_KEY },
      body: JSON.stringify({
        product_id: 'safespec',
        tenant_id: tenant.id,
        user_id: user.id,
        user_email: user.email,
        user_name: user.name,
        category: data.category,
        subject: data.subject,
        description: data.description,
        page_url: currentPath,
      }),
    });
  };

  return <SupportForm onSubmit={submitTicket} />;
};
```

### Ticket History (Optional — in each product)

Products can optionally show a "My Support Tickets" page:

```
GET {OPSHIELD_API_URL}/api/support/tickets?tenant_id={tenantId}&user_id={userId}

Response:
{
  "tickets": [
    {
      "ticket_number": "T-089",
      "subject": "Can't generate PDF for SWMS",
      "status": "resolved",
      "created_at": "2026-03-20T08:15:00Z",
      "last_reply_at": "2026-03-20T09:02:00Z"
    }
  ]
}
```

This is a lightweight read-only view — all ticket management happens in OpShield.

---

## Priority & SLA

### Auto-Priority Rules

| Condition | Priority |
|-----------|----------|
| Enterprise plan tenant | High |
| Category = billing + status = past_due | Urgent |
| Category = bug_report | Medium |
| Category = feature_request | Low |
| Category = how_to | Low |
| Default | Medium |

Admins can manually override priority.

### SLA Targets

| Priority | First Response | Resolution |
|----------|---------------|------------|
| Urgent | 1 hour | 4 hours |
| High | 4 hours | 1 business day |
| Medium | 1 business day | 3 business days |
| Low | 2 business days | 5 business days |

SLA tracking is informational for now (no automation) — the dashboard shows warnings when tickets approach SLA limits.

---

## Canned Responses

Pre-written response templates for common questions:

```
canned_responses
├── id (UUID)
├── title (text — "PDF Generation Troubleshooting")
├── body (text — the template text with {{placeholders}})
├── category (enum — maps to ticket categories)
├── product_id (text, nullable — product-specific responses)
├── usage_count (integer — how often used)
├── created_at
└── updated_at
```

Example canned responses:
- "How do I add a SWMS?" → Link to help docs
- "Billing question" → Check Stripe status, explain invoice
- "PDF generation failed" → Troubleshooting steps
- "Feature request acknowledged" → Thank you, added to backlog

---

## Support API Endpoints

### Tenant-Facing (called from products)

```
POST   /api/support/tickets                  — Create ticket
GET    /api/support/tickets                  — List user's tickets (filtered by tenant + user)
GET    /api/support/tickets/:number          — Get ticket detail + messages
POST   /api/support/tickets/:number/messages — Add message (customer reply via API)
POST   /api/support/tickets/:number/attachments — Upload attachment
```

### Admin-Facing (Platform Admin only)

```
GET    /api/admin/support/tickets            — List all tickets (paginated, filterable)
GET    /api/admin/support/tickets/:number    — Full ticket detail with tenant context
POST   /api/admin/support/tickets/:number/messages — Reply or add internal note
PATCH  /api/admin/support/tickets/:number    — Update status, priority, assignment, tags
GET    /api/admin/support/stats              — Open count, avg response time, SLA compliance
GET    /api/admin/support/canned-responses   — List canned responses
POST   /api/admin/support/canned-responses   — Create canned response
```

### Inbound Email Webhook

```
POST   /api/webhooks/inbound-email           — Receives parsed inbound emails from email provider
```

---

## What This Replaces

Without this system, support would be:
- Random emails to Ryan's personal inbox
- No tracking, no history, no SLA
- No tenant context (have to ask "what company are you with?")
- No way to see patterns (which product has the most bugs?)

With this system:
- Every ticket has full tenant context (company, plan, modules, user role)
- One-click impersonation to see exactly what the user sees
- Email-based for users (no new tool to learn), dashboard-based for admin
- Metrics on response times, common issues, product quality
