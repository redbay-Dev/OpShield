import type { FastifyInstance } from "fastify";
import { eq, and, isNull, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "../db/client.js";
import {
  supportTickets,
  supportMessages,
} from "../db/schema/support.js";
import { tenants } from "../db/schema/tenants.js";
import { sendTicketAcknowledgmentEmail } from "../services/email.js";
import { determinePriority } from "../services/support-utils.js";

/**
 * Schema for inbound email webhook payload.
 * Supports common formats from SMTP2GO, Mailgun, and Postmark.
 */
const inboundEmailSchema = z.object({
  from: z.string().min(1),
  fromName: z.string().optional(),
  to: z.string().min(1),
  subject: z.string().min(1),
  textBody: z.string().default(""),
  htmlBody: z.string().optional(),
  messageId: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

/** Extract ticket number from subject line — matches [T-001] pattern */
function extractTicketNumber(subject: string): string | null {
  const match = subject.match(/\[T-(\d+)\]/);
  if (!match || !match[1]) return null;
  return `T-${match[1]}`;
}

/** Extract email address from a "Name <email>" or plain "email" string */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  if (match && match[1]) return match[1];
  return from.trim();
}

/** Extract display name from "Name <email>" string */
function extractName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match && match[1]) return match[1].trim();
  return extractEmail(from);
}

/**
 * Inbound email webhook route.
 * Receives parsed emails from the email provider (SMTP2GO, Mailgun, Postmark).
 * Registered at /api/webhooks/inbound-email.
 */
export async function inboundEmailRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post("/api/webhooks/inbound-email", async (request, reply) => {
    const parsed = inboundEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid email payload",
          details: parsed.error.issues,
        },
      });
    }

    const email = parsed.data;
    const senderEmail = extractEmail(email.from);
    const senderName = email.fromName ?? extractName(email.from);

    // Check if this is a reply to an existing ticket
    const ticketNumber = extractTicketNumber(email.subject);

    if (ticketNumber) {
      // ── Reply to existing ticket ──
      const [ticket] = await db
        .select()
        .from(supportTickets)
        .where(
          and(
            eq(supportTickets.ticketNumber, ticketNumber),
            isNull(supportTickets.deletedAt),
          ),
        )
        .limit(1);

      if (!ticket) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: `Ticket ${ticketNumber} not found` },
        });
      }

      // Deduplicate by email message ID
      if (email.messageId) {
        const [existing] = await db
          .select({ id: supportMessages.id })
          .from(supportMessages)
          .where(eq(supportMessages.emailMessageId, email.messageId))
          .limit(1);

        if (existing) {
          return reply.send({
            success: true,
            data: { action: "deduplicated", ticketNumber },
          });
        }
      }

      // Add message to ticket thread
      await db.insert(supportMessages).values({
        ticketId: ticket.id,
        senderType: "customer",
        senderId: ticket.userId,
        senderName,
        senderEmail,
        body: email.textBody || "(no text content)",
        bodyHtml: email.htmlBody ?? null,
        isInternalNote: false,
        emailMessageId: email.messageId ?? null,
      });

      // Reopen if ticket was resolved or waiting on customer
      if (
        ticket.status === "resolved" ||
        ticket.status === "waiting_on_customer"
      ) {
        await db
          .update(supportTickets)
          .set({ status: "open", updatedAt: new Date() })
          .where(eq(supportTickets.id, ticket.id));
      }

      return reply.send({
        success: true,
        data: { action: "reply_added", ticketNumber },
      });
    }

    // ── New ticket from email ──
    const headers = email.headers ?? {};
    const productId = headers["x-nexum-product"] ?? "opshield";
    const tenantIdFromHeader = headers["x-nexum-tenant-id"];
    const userId = headers["x-nexum-user-id"] ?? senderEmail;
    const category = headers["x-nexum-category"] ?? "other";
    const pageUrl = headers["x-nexum-page"];

    // Resolve tenant ID
    let resolvedTenantId = tenantIdFromHeader;
    if (!resolvedTenantId) {
      const [existingTicket] = await db
        .select({ tenantId: supportTickets.tenantId })
        .from(supportTickets)
        .where(eq(supportTickets.userEmail, senderEmail))
        .limit(1);

      if (existingTicket) {
        resolvedTenantId = existingTicket.tenantId;
      }
    }

    if (!resolvedTenantId) {
      return reply.status(422).send({
        success: false,
        error: {
          code: "UNPROCESSABLE",
          message: "Could not determine tenant for this email. Include X-Nexum-Tenant-Id header or ensure the sender has existing tickets.",
        },
      });
    }

    // Verify tenant exists
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(eq(tenants.id, resolvedTenantId), isNull(tenants.deletedAt)))
      .limit(1);

    if (!tenant) {
      return reply.status(422).send({
        success: false,
        error: { code: "UNPROCESSABLE", message: "Tenant not found" },
      });
    }

    // Generate ticket number
    const [seqResult] = await db.execute(
      sql`SELECT nextval('support_ticket_seq') as seq`,
    );
    const seq = Number((seqResult as Record<string, unknown>).seq);
    const newTicketNumber = `T-${String(seq).padStart(3, "0")}`;

    const priority = await determinePriority(category, resolvedTenantId);

    const [newTicket] = await db
      .insert(supportTickets)
      .values({
        ticketNumber: newTicketNumber,
        productId,
        tenantId: resolvedTenantId,
        userId,
        userEmail: senderEmail,
        userName: senderName,
        category,
        subject: email.subject,
        description: email.textBody || "(no text content)",
        pageUrl: pageUrl ?? null,
        priority,
        emailThreadId: email.messageId ?? null,
      })
      .returning();

    if (!newTicket) {
      return reply.status(500).send({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create ticket" },
      });
    }

    await db.insert(supportMessages).values({
      ticketId: newTicket.id,
      senderType: "customer",
      senderId: userId,
      senderName,
      senderEmail,
      body: email.textBody || "(no text content)",
      bodyHtml: email.htmlBody ?? null,
      isInternalNote: false,
      emailMessageId: email.messageId ?? null,
    });

    // Send acknowledgment (fire-and-forget)
    void sendTicketAcknowledgmentEmail({
      to: senderEmail,
      userName: senderName,
      ticketNumber: newTicketNumber,
      subject: email.subject,
      category,
      priority,
    }).catch(() => {
      // Non-blocking
    });

    return reply.status(201).send({
      success: true,
      data: { action: "ticket_created", ticketNumber: newTicketNumber },
    });
  });
}
