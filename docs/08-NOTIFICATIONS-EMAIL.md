# 08 — Notifications & Transactional Email

> How OpShield sends platform-level notifications to tenants — billing alerts, trial reminders, subscription changes, welcome emails.

## Overview

OpShield sends **platform-level transactional emails** — notifications about billing, subscriptions, and account lifecycle. These are distinct from product emails (SafeSpec sending inspection reminders, Nexum sending dispatch notifications).

```
OpShield sends:                    Products send:
├── Welcome email                  ├── Inspection due reminders
├── Trial ending reminder          ├── SWMS approval requests
├── Payment received               ├── Job dispatch notifications
├── Payment failed                 ├── Compliance expiry alerts
├── Subscription changed           ├── Docket approval requests
├── Module added/removed           └── (product-specific)
├── Account suspended
├── Support ticket responses
└── 2FA setup / password reset
```

---

## Email Types

### Account Lifecycle

| Email | Trigger | Content |
|-------|---------|---------|
| Welcome | Sign-up completed + provisioned | Login link(s), getting started guide |
| Email verification | Account creation | Verification link (Better Auth built-in) |
| Password reset | User requests reset | Reset link (Better Auth built-in) |
| 2FA setup reminder | User hasn't enabled 2FA within 24h | Instructions, why it's required |

### Billing

| Email | Trigger | Content |
|-------|---------|---------|
| Trial ending (3 days) | `customer.subscription.trial_will_end` | Days remaining, plan options, payment CTA |
| Trial expired | Trial period ended without conversion | Last chance offer, data retention notice |
| Payment received | `invoice.payment_succeeded` | Invoice amount, link to invoice PDF |
| Payment failed | `invoice.payment_failed` | Retry info, update payment method link |
| Payment failed (final) | 3rd failed attempt | Suspension warning, 7-day grace period |
| Account suspended | Grace period expired | Read-only notice, reactivation link |
| Plan changed | Upgrade/downgrade confirmed | New plan details, effective date |
| Module added | Module activated | What's now available, getting started |
| Module removed | Module cancelled | Access end date, data retention (90 days) |

### Support

| Email | Trigger | Content |
|-------|---------|---------|
| Ticket received | New support ticket created | Ticket number, expected response time |
| Ticket reply | Admin responds to ticket | Reply content, reply-to for threading |
| Ticket resolved | Admin marks resolved | Resolution summary, feedback request |

---

## Email Infrastructure

### Provider: SMTP2GO

Already used by SafeSpec for transactional email. OpShield uses the same provider:

- **Dev:** MailHog on port 1025 (shared instance, web UI on 8025)
- **Prod:** SMTP2GO (Australian-friendly, good deliverability)

### Email Templates

Handlebars templates for consistent branding:

```
packages/backend/src/email/templates/
├── layouts/
│   └── base.hbs              # Shared header/footer, Redbay branding
├── welcome.hbs
├── trial-ending.hbs
├── payment-received.hbs
├── payment-failed.hbs
├── account-suspended.hbs
├── plan-changed.hbs
├── module-added.hbs
├── module-removed.hbs
├── support-ticket-received.hbs
├── support-ticket-reply.hbs
└── support-ticket-resolved.hbs
```

### Sending Architecture

```typescript
// OpShield email service
import { createTransport } from 'nodemailer';
import Handlebars from 'handlebars';

const sendEmail = async ({
  to,
  subject,
  template,
  data,
  replyTo,
}: SendEmailParams): Promise<void> => {
  const html = renderTemplate(template, {
    ...data,
    year: new Date().getFullYear(),
    supportEmail: 'support@redbay.com.au',
    unsubscribeUrl: `${OPSHIELD_URL}/account/notifications`,
  });

  await transporter.sendMail({
    from: '"Redbay" <noreply@redbay.com.au>',
    to,
    subject,
    html,
    replyTo: replyTo ?? 'support@redbay.com.au',
  });
};
```

### Spam Act 2003 Compliance (Australian)

All marketing/transactional emails must:
- Identify the sender (Redbay Development Pty Ltd)
- Include a valid physical address
- Include an unsubscribe mechanism (for non-essential notifications)
- Honour unsubscribe within 5 business days

Better Auth handles auth-related emails (verification, password reset) — these are exempt from marketing rules as they are functional.

---

## Notification Preferences

Tenants can control which non-essential emails they receive:

```
notification_preferences
├── id (UUID)
├── user_id → user.id
├── billing_emails (boolean, default: true — payment receipts, plan changes)
├── support_emails (boolean, default: true — ticket updates)
├── product_updates (boolean, default: true — new features, announcements)
├── created_at
└── updated_at
```

**Cannot be disabled:** Payment failed warnings, account suspension, security alerts (2FA, password reset).

---

## Environment Variables

```env
# Email (dev)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false

# Email (prod)
SMTP_HOST=mail.smtp2go.com
SMTP_PORT=2525
SMTP_SECURE=true
SMTP_USER=<smtp2go-username>
SMTP_PASS=<smtp2go-password>

# Sender
EMAIL_FROM=noreply@redbay.com.au
EMAIL_REPLY_TO=support@redbay.com.au
```
