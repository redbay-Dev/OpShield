import { Building2, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { useTenants } from "@frontend/hooks/use-tenants.js";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: StatCardProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage(): React.JSX.Element {
  const { data: allTenants } = useTenants({ limit: 1 });
  const { data: activeTenants } = useTenants({
    limit: 1,
    status: "active",
  });
  const { data: suspendedTenants } = useTenants({
    limit: 1,
    status: "suspended",
  });
  const { data: onboardingTenants } = useTenants({
    limit: 1,
    status: "onboarding",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview and key metrics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tenants"
          value={allTenants?.total ?? 0}
          icon={Building2}
          description="All registered tenants"
        />
        <StatCard
          title="Active"
          value={activeTenants?.total ?? 0}
          icon={CheckCircle}
          description="Currently active"
        />
        <StatCard
          title="Onboarding"
          value={onboardingTenants?.total ?? 0}
          icon={AlertTriangle}
          description="Setting up"
        />
        <StatCard
          title="Suspended"
          value={suspendedTenants?.total ?? 0}
          icon={XCircle}
          description="Temporarily disabled"
        />
      </div>
    </div>
  );
}
