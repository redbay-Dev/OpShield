import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { eq, and, isNull, desc, sql, count } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  supportTickets,
  supportMessages,
  supportAttachments,
} from "../db/schema/support.js";
import { tenants } from "../db/schema/tenants.js";
import { requireServiceAuth } from "../middleware/require-service-auth.js";
import type { ServiceKeyAuth } from "../middleware/require-service-auth.js";
import {
  createTicketSchema,
  tenantTicketListQuerySchema,
  ticketNumberParamSchema,
  createTicketMessageSchema,
} from "@opshield/shared/schemas";
import { sendTicketAcknowledgmentEmail } from "../services/email.js";
import { determinePriority } from "../services/support-utils.js";
import { uploadFile, getDownloadUrl } from "../services/storage.js";

function formatTicket(
  ticket: typeof supportTickets.$inferSelect,
): Record<string, unknown> {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    productId: ticket.productId,
    tenantId: ticket.tenantId,
    userId: ticket.userId,
    userEmail: ticket.userEmail,
    userName: ticket.userName,
    category: ticket.category,
    subject: ticket.subject,
    priority: ticket.priority,
    status: ticket.status,
    assignedTo: ticket.assignedTo,
    tags: ticket.tags,
    firstResponseAt: ticket.firstResponseAt?.toISOString() ?? null,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

function formatMessage(
  msg: typeof supportMessages.$inferSelect,
): Record<string, unknown> {
  return {
    id: msg.id,
    ticketId: msg.ticketId,
    senderType: msg.senderType,
    senderId: msg.senderId,
    senderName: msg.senderName,
    senderEmail: msg.senderEmail,
    body: msg.body,
    isInternalNote: msg.isInternalNote,
    createdAt: msg.createdAt.toISOString(),
  };
}

/**
 * Tenant-facing support ticket routes.
 * Authenticated via service API key from product backends.
 */
export async function supportTicketRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── POST /support/tickets — Create ticket (from product backend) ──
  app.post(
    "/support/tickets",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const parsed = createTicketSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.issues,
          },
        });
      }

      const data = parsed.data;

      // Verify the tenant exists
      const [tenant] = await db
        .select({ id: tenants.id, status: tenants.status })
        .from(tenants)
        .where(
          and(eq(tenants.id, data.tenantId), isNull(tenants.deletedAt)),
        )
        .limit(1);

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Tenant not found" },
        });
      }

      // Generate ticket number
      const [seqResult] = await db.execute(
        sql`SELECT nextval('support_ticket_seq') as seq`,
      );
      const seq = Number((seqResult as Record<string, unknown>).seq);
      const ticketNumber = `T-${String(seq).padStart(3, "0")}`;

      // Determine priority based on auto-rules
      const priority = await determinePriority(
        data.category,
        data.tenantId,
      );

      // Create ticket
      const [ticket] = await db
        .insert(supportTickets)
        .values({
          ticketNumber,
          productId: data.productId,
          tenantId: data.tenantId,
          userId: data.userId,
          userEmail: data.userEmail,
          userName: data.userName,
          category: data.category,
          subject: data.subject,
          description: data.description,
          pageUrl: data.pageUrl ?? null,
          browserInfo: data.browserInfo ?? null,
          priority,
        })
        .returning();

      if (!ticket) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create ticket" },
        });
      }

      // Create initial message from the description
      await db.insert(supportMessages).values({
        ticketId: ticket.id,
        senderType: "customer",
        senderId: data.userId,
        senderName: data.userName,
        senderEmail: data.userEmail,
        body: data.description,
        isInternalNote: false,
      });

      // Send acknowledgment email (fire-and-forget)
      void sendTicketAcknowledgmentEmail({
        to: data.userEmail,
        userName: data.userName,
        ticketNumber,
        subject: data.subject,
        category: data.category,
        priority,
      }).catch(() => {
        // Non-blocking — email failure never blocks ticket creation
      });

      return reply.status(201).send({
        success: true,
        data: {
          ...formatTicket(ticket),
          description: ticket.description,
          pageUrl: ticket.pageUrl,
          browserInfo: ticket.browserInfo,
        },
      });
    },
  );

  // ── GET /support/tickets — List tickets for a tenant/user ──
  app.get(
    "/support/tickets",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const parsed = tenantTicketListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: parsed.error.issues,
          },
        });
      }

      const { page, limit, tenantId, userId } = parsed.data;
      const offset = (page - 1) * limit;

      const conditions = [
        eq(supportTickets.tenantId, tenantId),
        isNull(supportTickets.deletedAt),
      ];

      if (userId) {
        conditions.push(eq(supportTickets.userId, userId));
      }

      const where = and(...conditions);

      const [items, countRows] = await Promise.all([
        db
          .select()
          .from(supportTickets)
          .where(where)
          .orderBy(desc(supportTickets.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(supportTickets)
          .where(where),
      ]);

      const total = countRows[0]?.total ?? 0;

      return reply.send({
        success: true,
        data: {
          items: items.map(formatTicket),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  // ── GET /support/tickets/:ticketNumber — Get ticket detail ──
  app.get(
    "/support/tickets/:ticketNumber",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const parsed = ticketNumberParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid ticket number",
            details: parsed.error.issues,
          },
        });
      }

      const { ticketNumber } = parsed.data;

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
          error: { code: "NOT_FOUND", message: "Ticket not found" },
        });
      }

      // Only return non-internal messages for tenant-facing requests
      const serviceKey = (
        request as FastifyRequest & { serviceKey?: ServiceKeyAuth }
      ).serviceKey;

      const messages = await db
        .select()
        .from(supportMessages)
        .where(
          serviceKey
            ? and(
                eq(supportMessages.ticketId, ticket.id),
                eq(supportMessages.isInternalNote, false),
              )
            : eq(supportMessages.ticketId, ticket.id),
        )
        .orderBy(supportMessages.createdAt);

      return reply.send({
        success: true,
        data: {
          ...formatTicket(ticket),
          description: ticket.description,
          pageUrl: ticket.pageUrl,
          browserInfo: ticket.browserInfo,
          messages: messages.map(formatMessage),
        },
      });
    },
  );

  // ── POST /support/tickets/:ticketNumber/messages — Customer reply ──
  app.post(
    "/support/tickets/:ticketNumber/messages",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const paramParsed = ticketNumberParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid ticket number",
            details: paramParsed.error.issues,
          },
        });
      }

      const bodyParsed = createTicketMessageSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: bodyParsed.error.issues,
          },
        });
      }

      const { ticketNumber } = paramParsed.data;
      const { body: messageBody } = bodyParsed.data;

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
          error: { code: "NOT_FOUND", message: "Ticket not found" },
        });
      }

      // Create message
      const [message] = await db
        .insert(supportMessages)
        .values({
          ticketId: ticket.id,
          senderType: "customer",
          senderId: ticket.userId,
          senderName: ticket.userName,
          senderEmail: ticket.userEmail,
          body: messageBody,
          isInternalNote: false,
        })
        .returning();

      if (!message) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create message" },
        });
      }

      // If ticket was resolved/waiting_on_customer, reopen it
      if (
        ticket.status === "resolved" ||
        ticket.status === "waiting_on_customer"
      ) {
        await db
          .update(supportTickets)
          .set({ status: "open", updatedAt: new Date() })
          .where(eq(supportTickets.id, ticket.id));
      }

      return reply.status(201).send({
        success: true,
        data: formatMessage(message),
      });
    },
  );

  // ── POST /support/tickets/:ticketNumber/attachments — Upload attachment ──
  app.post(
    "/support/tickets/:ticketNumber/attachments",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const paramParsed = ticketNumberParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid ticket number",
            details: paramParsed.error.issues,
          },
        });
      }

      const { ticketNumber } = paramParsed.data;

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
          error: { code: "NOT_FOUND", message: "Ticket not found" },
        });
      }

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "No file uploaded" },
        });
      }

      // Validate file size (max 10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      const buffer = await file.toBuffer();
      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "File size exceeds 10MB limit" },
        });
      }

      // Validate MIME type (allow images, PDFs, text, common docs)
      const ALLOWED_TYPES = new Set([
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/json",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]);

      if (!ALLOWED_TYPES.has(file.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `File type ${file.mimetype} not allowed. Accepted: images, PDF, text, CSV, Excel, Word.`,
          },
        });
      }

      // Upload to MinIO/S3
      const storageKey = `support/${ticket.id}/${randomUUID()}/${file.filename}`;
      await uploadFile({
        key: storageKey,
        body: buffer,
        contentType: file.mimetype,
      });

      // Record in DB
      const [attachment] = await db
        .insert(supportAttachments)
        .values({
          ticketId: ticket.id,
          fileName: file.filename,
          fileSize: buffer.length,
          mimeType: file.mimetype,
          storageKey,
          uploadedBy: ticket.userId,
        })
        .returning();

      if (!attachment) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to save attachment" },
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          id: attachment.id,
          ticketId: attachment.ticketId,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          createdAt: attachment.createdAt.toISOString(),
        },
      });
    },
  );

  // ── GET /support/tickets/:ticketNumber/attachments — List attachments ──
  app.get(
    "/support/tickets/:ticketNumber/attachments",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const paramParsed = ticketNumberParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid ticket number",
            details: paramParsed.error.issues,
          },
        });
      }

      const { ticketNumber } = paramParsed.data;

      const [ticket] = await db
        .select({ id: supportTickets.id })
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
          error: { code: "NOT_FOUND", message: "Ticket not found" },
        });
      }

      const attachments = await db
        .select()
        .from(supportAttachments)
        .where(eq(supportAttachments.ticketId, ticket.id))
        .orderBy(supportAttachments.createdAt);

      return reply.send({
        success: true,
        data: attachments.map((a) => ({
          id: a.id,
          ticketId: a.ticketId,
          messageId: a.messageId,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          createdAt: a.createdAt.toISOString(),
        })),
      });
    },
  );

  // ── GET /support/tickets/:ticketNumber/attachments/:attachmentId/download — Download attachment ──
  app.get(
    "/support/tickets/:ticketNumber/attachments/:attachmentId/download",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const params = request.params as { ticketNumber: string; attachmentId: string };

      const [ticket] = await db
        .select({ id: supportTickets.id })
        .from(supportTickets)
        .where(
          and(
            eq(supportTickets.ticketNumber, params.ticketNumber),
            isNull(supportTickets.deletedAt),
          ),
        )
        .limit(1);

      if (!ticket) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Ticket not found" },
        });
      }

      const [attachment] = await db
        .select()
        .from(supportAttachments)
        .where(
          and(
            eq(supportAttachments.id, params.attachmentId),
            eq(supportAttachments.ticketId, ticket.id),
          ),
        )
        .limit(1);

      if (!attachment) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Attachment not found" },
        });
      }

      const url = await getDownloadUrl(attachment.storageKey);

      return reply.send({
        success: true,
        data: { downloadUrl: url },
      });
    },
  );
}
