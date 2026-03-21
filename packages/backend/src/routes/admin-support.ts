import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, and, isNull, desc, sql, count, or } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  supportTickets,
  supportMessages,
  cannedResponses,
} from "../db/schema/support.js";
import { tenants, auditLog } from "../db/schema/tenants.js";
import {
  requirePlatformAdmin,
  requireWriteAccess,
  type PlatformAdminAuth,
} from "../middleware/require-platform-admin.js";
import {
  ticketListQuerySchema,
  ticketNumberParamSchema,
  updateTicketSchema,
  createTicketMessageSchema,
  createCannedResponseSchema,
} from "@opshield/shared/schemas";
import { sendTicketReplyEmail } from "../services/email.js";

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

const PRODUCT_NAMES: Record<string, string> = {
  safespec: "SafeSpec",
  nexum: "Nexum",
  opshield: "OpShield",
};

/**
 * Admin-facing support ticket routes.
 * Accessible to platform admins only.
 */
export async function adminSupportRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── GET /admin/support/tickets — List all tickets ──
  app.get(
    "/admin/support/tickets",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const parsed = ticketListQuerySchema.safeParse(request.query);
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

      const { page, limit, status, priority, productId, tenantId, assignedTo, category } =
        parsed.data;
      const offset = (page - 1) * limit;

      const conditions = [isNull(supportTickets.deletedAt)];

      if (status) conditions.push(eq(supportTickets.status, status));
      if (priority) conditions.push(eq(supportTickets.priority, priority));
      if (productId) conditions.push(eq(supportTickets.productId, productId));
      if (tenantId) conditions.push(eq(supportTickets.tenantId, tenantId));
      if (assignedTo) conditions.push(eq(supportTickets.assignedTo, assignedTo));
      if (category) conditions.push(eq(supportTickets.category, category));

      const where = and(...conditions);

      const [items, countRows] = await Promise.all([
        db
          .select({
            ticket: supportTickets,
            tenantName: tenants.name,
          })
          .from(supportTickets)
          .leftJoin(tenants, eq(supportTickets.tenantId, tenants.id))
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
          items: items.map((row) => ({
            ...formatTicket(row.ticket),
            tenantName: row.tenantName,
          })),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  // ── GET /admin/support/tickets/:ticketNumber — Full detail ──
  app.get(
    "/admin/support/tickets/:ticketNumber",
    { preHandler: [requirePlatformAdmin] },
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

      const [result] = await db
        .select({
          ticket: supportTickets,
          tenantName: tenants.name,
          tenantStatus: tenants.status,
        })
        .from(supportTickets)
        .leftJoin(tenants, eq(supportTickets.tenantId, tenants.id))
        .where(
          and(
            eq(supportTickets.ticketNumber, ticketNumber),
            isNull(supportTickets.deletedAt),
          ),
        )
        .limit(1);

      if (!result) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Ticket not found" },
        });
      }

      // All messages including internal notes (admin view)
      const messages = await db
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, result.ticket.id))
        .orderBy(supportMessages.createdAt);

      return reply.send({
        success: true,
        data: {
          ...formatTicket(result.ticket),
          description: result.ticket.description,
          pageUrl: result.ticket.pageUrl,
          browserInfo: result.ticket.browserInfo,
          messages: messages.map(formatMessage),
          tenantName: result.tenantName,
          tenantStatus: result.tenantStatus,
        },
      });
    },
  );

  // ── POST /admin/support/tickets/:ticketNumber/messages — Admin reply / internal note ──
  app.post(
    "/admin/support/tickets/:ticketNumber/messages",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
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
      const { body: messageBody, isInternalNote } = bodyParsed.data;

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

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      // Get admin user info for the message
      const adminName = `Admin (${admin.role})`;

      const [message] = await db
        .insert(supportMessages)
        .values({
          ticketId: ticket.id,
          senderType: "admin",
          senderId: admin.userId,
          senderName: adminName,
          senderEmail: "support@nexum.net.au",
          body: messageBody,
          isInternalNote,
        })
        .returning();

      if (!message) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create message" },
        });
      }

      // Track first response time
      if (!ticket.firstResponseAt && !isInternalNote) {
        await db
          .update(supportTickets)
          .set({
            firstResponseAt: new Date(),
            status: "in_progress",
            updatedAt: new Date(),
          })
          .where(eq(supportTickets.id, ticket.id));
      }

      // Send email to customer for non-internal replies
      if (!isInternalNote) {
        void sendTicketReplyEmail({
          to: ticket.userEmail,
          userName: ticket.userName,
          agentName: adminName,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          replyBody: messageBody,
          productName: PRODUCT_NAMES[ticket.productId] ?? ticket.productId,
        }).catch(() => {
          // Non-blocking
        });
      }

      // Audit log
      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: isInternalNote ? "support.internal_note" : "support.reply",
        resourceType: "support_ticket",
        resourceId: ticket.id,
        metadata: { ticketNumber: ticket.ticketNumber },
      });

      return reply.status(201).send({
        success: true,
        data: formatMessage(message),
      });
    },
  );

  // ── PATCH /admin/support/tickets/:ticketNumber — Update ticket ──
  app.patch(
    "/admin/support/tickets/:ticketNumber",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
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

      const bodyParsed = updateTicketSchema.safeParse(request.body);
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
      const updates = bodyParsed.data;

      const [existing] = await db
        .select()
        .from(supportTickets)
        .where(
          and(
            eq(supportTickets.ticketNumber, ticketNumber),
            isNull(supportTickets.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Ticket not found" },
        });
      }

      const setValues: Record<string, unknown> = { updatedAt: new Date() };

      if (updates.status !== undefined) {
        setValues.status = updates.status;
        if (updates.status === "resolved" && !existing.resolvedAt) {
          setValues.resolvedAt = new Date();
        }
        if (updates.status === "closed" && !existing.closedAt) {
          setValues.closedAt = new Date();
        }
      }
      if (updates.priority !== undefined) {
        setValues.priority = updates.priority;
      }
      if (updates.assignedTo !== undefined) {
        setValues.assignedTo = updates.assignedTo;
      }
      if (updates.tags !== undefined) {
        setValues.tags = updates.tags;
      }

      const [updated] = await db
        .update(supportTickets)
        .set(setValues)
        .where(eq(supportTickets.id, existing.id))
        .returning();

      if (!updated) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to update ticket" },
        });
      }

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: "support.ticket_updated",
        resourceType: "support_ticket",
        resourceId: existing.id,
        metadata: {
          ticketNumber,
          changes: updates,
        },
      });

      return reply.send({
        success: true,
        data: formatTicket(updated),
      });
    },
  );

  // ── GET /admin/support/stats — Support statistics ──
  app.get(
    "/admin/support/stats",
    { preHandler: [requirePlatformAdmin] },
    async (_request, reply) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        openRows,
        inProgressRows,
        waitingRows,
        resolvedTodayRows,
        avgFirstResponseRows,
        avgResolutionRows,
      ] = await Promise.all([
        db
          .select({ total: count() })
          .from(supportTickets)
          .where(
            and(
              eq(supportTickets.status, "open"),
              isNull(supportTickets.deletedAt),
            ),
          ),
        db
          .select({ total: count() })
          .from(supportTickets)
          .where(
            and(
              eq(supportTickets.status, "in_progress"),
              isNull(supportTickets.deletedAt),
            ),
          ),
        db
          .select({ total: count() })
          .from(supportTickets)
          .where(
            and(
              or(
                eq(supportTickets.status, "waiting_on_customer"),
                eq(supportTickets.status, "waiting_on_internal"),
              ),
              isNull(supportTickets.deletedAt),
            ),
          ),
        db
          .select({ total: count() })
          .from(supportTickets)
          .where(
            and(
              eq(supportTickets.status, "resolved"),
              isNull(supportTickets.deletedAt),
              sql`${supportTickets.resolvedAt} >= ${today.toISOString()}`,
            ),
          ),
        db
          .select({
            avg: sql<number>`AVG(EXTRACT(EPOCH FROM (${supportTickets.firstResponseAt} - ${supportTickets.createdAt})) / 60)`,
          })
          .from(supportTickets)
          .where(
            and(
              isNull(supportTickets.deletedAt),
              sql`${supportTickets.firstResponseAt} IS NOT NULL`,
            ),
          ),
        db
          .select({
            avg: sql<number>`AVG(EXTRACT(EPOCH FROM (${supportTickets.resolvedAt} - ${supportTickets.createdAt})) / 60)`,
          })
          .from(supportTickets)
          .where(
            and(
              isNull(supportTickets.deletedAt),
              sql`${supportTickets.resolvedAt} IS NOT NULL`,
            ),
          ),
      ]);

      const avgFirstResponse = avgFirstResponseRows[0]?.avg;
      const avgResolution = avgResolutionRows[0]?.avg;

      return reply.send({
        success: true,
        data: {
          openCount: openRows[0]?.total ?? 0,
          inProgressCount: inProgressRows[0]?.total ?? 0,
          waitingCount: waitingRows[0]?.total ?? 0,
          resolvedTodayCount: resolvedTodayRows[0]?.total ?? 0,
          avgFirstResponseMinutes: avgFirstResponse
            ? Math.round(Number(avgFirstResponse))
            : null,
          avgResolutionMinutes: avgResolution
            ? Math.round(Number(avgResolution))
            : null,
        },
      });
    },
  );

  // ── GET /admin/support/canned-responses — List canned responses ──
  app.get(
    "/admin/support/canned-responses",
    { preHandler: [requirePlatformAdmin] },
    async (_request, reply) => {
      const items = await db
        .select()
        .from(cannedResponses)
        .orderBy(desc(cannedResponses.usageCount));

      return reply.send({
        success: true,
        data: items.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          category: item.category,
          productId: item.productId,
          usageCount: item.usageCount,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
      });
    },
  );

  // ── POST /admin/support/canned-responses — Create canned response ──
  app.post(
    "/admin/support/canned-responses",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const parsed = createCannedResponseSchema.safeParse(request.body);
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

      const [item] = await db
        .insert(cannedResponses)
        .values({
          title: parsed.data.title,
          body: parsed.data.body,
          category: parsed.data.category ?? null,
          productId: parsed.data.productId ?? null,
        })
        .returning();

      if (!item) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create canned response" },
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          id: item.id,
          title: item.title,
          body: item.body,
          category: item.category,
          productId: item.productId,
          usageCount: item.usageCount,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        },
      });
    },
  );
}
