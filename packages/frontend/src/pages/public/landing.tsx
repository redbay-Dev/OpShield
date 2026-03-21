import { Link } from "react-router";
import { Shield, Zap, Lock, BarChart3, ArrowRight } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card.js";

const PRODUCTS = [
  {
    name: "SafeSpec",
    description: "Work Health & Safety and Heavy Vehicle Accreditation compliance management for Australian operators.",
    features: ["Hazard & incident tracking", "SWMS & inspections", "Fatigue management", "CoR compliance", "Fleet maintenance"],
    icon: Shield,
  },
  {
    name: "Nexum",
    description: "Operations management for transport, logistics, and haulage — jobs, scheduling, invoicing, and more.",
    features: ["Job management", "Scheduling & dispatch", "Invoicing & RCTI", "Xero integration", "Compliance bridge"],
    icon: Zap,
  },
] as const;

const PLATFORM_FEATURES = [
  {
    title: "Single Sign-On",
    description: "One account across all products. Microsoft SSO support for enterprise teams.",
    icon: Lock,
  },
  {
    title: "Unified Billing",
    description: "One subscription, one invoice. Bundle SafeSpec and Nexum for up to 15% off.",
    icon: BarChart3,
  },
  {
    title: "Instant Provisioning",
    description: "Add products and modules on demand. Your workspace is ready in seconds.",
    icon: Zap,
  },
] as const;

export function LandingPage(): React.JSX.Element {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          One platform for your
          <br />
          entire operation
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Compliance, operations, and fleet management — connected through a single platform.
          Built for Australian transport, logistics, and construction.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link to="/signup">
              Get Started
              <ArrowRight />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/pricing">View Pricing</Link>
          </Button>
        </div>
      </section>

      {/* Products */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Two products. One platform.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Choose one or both — they work independently or together.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {PRODUCTS.map((product) => (
              <Card key={product.name} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <product.icon className="size-5" />
                    </div>
                    <CardTitle className="text-xl">{product.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <p className="text-muted-foreground">{product.description}</p>
                  <ul className="grid gap-2 text-sm">
                    {product.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <div className="size-1.5 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          The Nexum platform
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Authentication, billing, and provisioning — handled for you.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLATFORM_FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <feature.icon className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to get started?</h2>
          <p className="mt-3 text-muted-foreground">
            Set up your account in minutes. No credit card required for the first 14 days.
          </p>
          <Button size="lg" className="mt-6" asChild>
            <Link to="/signup">
              Start Free Trial
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
