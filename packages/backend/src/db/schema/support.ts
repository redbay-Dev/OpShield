import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

/**
 * Support tickets — centralized ticketing for all Redbay products.
 * Tickets are created via API from product backends or directly by admins.
 */
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketNumber: varchar("ticket_number", { length: 20 }).notNull().unique(),
  productId: varchar("product_id", { length: 50 }).notNull(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: text("user_id").notNull(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  userName: varchar("user_name", { length: 255 }).notNull(),
  category: varchar("category", { length: 30 }).notNull().default("other"),
  subject: varchar("subject", { length: 500 }).notNull(),
  description: text("description").notNull(),
  pageUrl: text("page_url"),
  browserInfo: jsonb("browser_info").$type<Record<string, unknown>>(),
  priority: varchar("priority", { length: 20 }).notNull().default("medium"),
  status: varchar("status", { length: 30 }).notNull().default("open"),
  assignedTo: uuid("assigned_to"),
  tags: text("tags").array().notNull().default([]),
  emailThreadId: text("email_thread_id"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/**
 * Messages within a support ticket conversation.
 * Immutable — no updates or soft deletes.
 */
export const supportMessages = pgTable("support_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => supportTickets.id),
  senderType: varchar("sender_type", { length: 20 }).notNull(),
  senderId: text("sender_id").notNull(),
  senderName: varchar("sender_name", { length: 255 }).notNull(),
  senderEmail: varchar("sender_email", { length: 255 }).notNull(),
  body: text("body").notNull(),
  bodyHtml: text("body_html"),
  isInternalNote: boolean("is_internal_note").notNull().default(false),
  emailMessageId: text("email_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * File attachments on tickets or messages.
 * Stored in MinIO/S3. Immutable.
 */
export const supportAttachments = pgTable("support_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => supportTickets.id),
  messageId: uuid("message_id").references(() => supportMessages.id),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  storageKey: text("storage_key").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Canned response templates for common support replies.
 */
export const cannedResponses = pgTable("canned_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 30 }),
  productId: varchar("product_id", { length: 50 }),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
