import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { subscriptions, subscriptionItems, plans } from "../db/schema/billing.js";
import type { TicketPriority } from "@opshield/shared/constants";

/**
 * Determine ticket priority based on auto-rules:
 * - Enterprise plan → high
 * - billing category + past_due subscription → urgent
 * - bug_report → medium
 * - feature_request / how_to → low
 * - Default → medium
 */
export async function determinePriority(
  category: string,
  tenantId: string,
): Promise<TicketPriority> {
  // Check if tenant is on an enterprise plan
  const tenantSubscription = await db
    .select({
      status: subscriptions.status,
      tier: plans.tier,
    })
    .from(subscriptions)
    .innerJoin(
      subscriptionItems,
      eq(subscriptionItems.subscriptionId, subscriptions.id),
    )
    .innerJoin(plans, eq(plans.id, subscriptionItems.planId))
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  const isEnterprise = tenantSubscription.some(
    (row) => row.tier === "enterprise",
  );
  const isPastDue = tenantSubscription.some(
    (row) => row.status === "past_due",
  );

  // Billing + past_due → urgent
  if (category === "billing" && isPastDue) {
    return "urgent";
  }

  // Enterprise → high
  if (isEnterprise) {
    return "high";
  }

  // Category-based
  switch (category) {
    case "bug_report":
      return "medium";
    case "feature_request":
    case "how_to":
      return "low";
    default:
      return "medium";
  }
}
