import { db, closeDbConnections } from "./client.js";
import { plans } from "./schema/billing.js";
import { tenants, tenantModules, platformAdmins } from "./schema/tenants.js";
import { user, account } from "./schema/auth.js";
import { tenantUsers } from "./schema/tenant-users.js";

async function seed(): Promise<void> {
  console.warn("Seeding OpShield database...");

  // ── Plans ──
  await db
    .insert(plans)
    .values([
      // SafeSpec WHS
      {
        name: "SafeSpec WHS Starter",
        productId: "safespec",
        moduleId: "safespec-whs",
        tier: "starter",
        basePrice: "49.00",
        includedUsers: 5,
        perUserPrice: "8.00",
        billingInterval: "monthly",
        features: ["Hazard Register", "Incident Reporting", "Basic Inspections"],
      },
      {
        name: "SafeSpec WHS Professional",
        productId: "safespec",
        moduleId: "safespec-whs",
        tier: "professional",
        basePrice: "99.00",
        includedUsers: 10,
        perUserPrice: "7.00",
        billingInterval: "monthly",
        features: ["All Starter", "SWMS", "Corrective Actions", "Custom Templates"],
      },
      {
        name: "SafeSpec WHS Enterprise",
        productId: "safespec",
        moduleId: "safespec-whs",
        tier: "enterprise",
        basePrice: "199.00",
        includedUsers: 25,
        perUserPrice: "5.00",
        billingInterval: "monthly",
        features: ["All Professional", "API Access", "SSO", "Dedicated Support"],
      },
      // SafeSpec HVA
      {
        name: "SafeSpec HVA Starter",
        productId: "safespec",
        moduleId: "safespec-hva",
        tier: "starter",
        basePrice: "59.00",
        includedUsers: 5,
        perUserPrice: "9.00",
        billingInterval: "monthly",
        features: ["Fatigue Management", "Mass Management", "Basic Compliance"],
      },
      {
        name: "SafeSpec HVA Professional",
        productId: "safespec",
        moduleId: "safespec-hva",
        tier: "professional",
        basePrice: "119.00",
        includedUsers: 10,
        perUserPrice: "8.00",
        billingInterval: "monthly",
        features: ["All Starter", "SMS Builder", "CoR Management", "Fitness to Drive"],
      },
      {
        name: "SafeSpec HVA Enterprise",
        productId: "safespec",
        moduleId: "safespec-hva",
        tier: "enterprise",
        basePrice: "229.00",
        includedUsers: 25,
        perUserPrice: "6.00",
        billingInterval: "monthly",
        features: ["All Professional", "Fleet Maintenance", "API Access", "SSO"],
      },
      // Nexum Core
      {
        name: "Nexum Core Starter",
        productId: "nexum",
        moduleId: "nexum-core",
        tier: "starter",
        basePrice: "79.00",
        includedUsers: 5,
        perUserPrice: "10.00",
        billingInterval: "monthly",
        features: ["Jobs", "Business Entities", "Scheduling", "Dashboard"],
      },
      {
        name: "Nexum Core Professional",
        productId: "nexum",
        moduleId: "nexum-core",
        tier: "professional",
        basePrice: "149.00",
        includedUsers: 10,
        perUserPrice: "9.00",
        billingInterval: "monthly",
        features: ["All Starter", "Advanced Scheduling", "Reporting"],
      },
      {
        name: "Nexum Core Enterprise",
        productId: "nexum",
        moduleId: "nexum-core",
        tier: "enterprise",
        basePrice: "299.00",
        includedUsers: 25,
        perUserPrice: "7.00",
        billingInterval: "monthly",
        features: ["All Professional", "API Access", "SSO", "Priority Support"],
      },
    ])
    .onConflictDoNothing();

  // ── Test Tenant ──
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Demo Haulage Pty Ltd",
      slug: "demo-haulage",
      status: "active",
      billingEmail: "billing@demo-haulage.test",
    })
    .onConflictDoNothing({ target: tenants.slug })
    .returning();

  if (tenant) {
    // ── Tenant Modules ──
    await db
      .insert(tenantModules)
      .values([
        {
          tenantId: tenant.id,
          productId: "safespec",
          moduleId: "safespec-whs",
          status: "active",
          maxUsers: 10,
          currentUsers: 3,
        },
        {
          tenantId: tenant.id,
          productId: "nexum",
          moduleId: "nexum-core",
          status: "active",
          maxUsers: 10,
          currentUsers: 5,
        },
      ])
      .onConflictDoNothing();

    // ── Test User (admin) ──
    const testUserId = "seed-admin-user-001";
    await db
      .insert(user)
      .values({
        id: testUserId,
        name: "Admin User",
        email: "admin@demo.test",
        emailVerified: true,
      })
      .onConflictDoNothing();

    // ── Create credential account for test user ──
    await db
      .insert(account)
      .values({
        id: "seed-admin-account-001",
        accountId: testUserId,
        providerId: "credential",
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // ── Link user to tenant ──
    await db
      .insert(tenantUsers)
      .values({
        userId: testUserId,
        tenantId: tenant.id,
        role: "owner",
      })
      .onConflictDoNothing();

    // ── Platform Admin ──
    await db
      .insert(platformAdmins)
      .values({
        userId: testUserId,
        role: "admin",
      })
      .onConflictDoNothing();
  }

  console.warn("Seed complete.");
  await closeDbConnections();
}

void seed();
