import { Link } from "react-router";
import {
  Building2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Button } from "@frontend/components/ui/button.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";
import { useTenants } from "@frontend/hooks/use-tenants.js";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  onboarding: "secondary",
  suspended: "destructive",
  cancelled: "outline",
};

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
  const { data: recentTenants } = useTenants({ limit: 5 });

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

      {/* Recent Tenants */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Tenants</CardTitle>
          <Link to="/admin/tenants">
            <Button variant="ghost" size="sm">
              View all
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentTenants?.items.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No tenants yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTenants?.items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{t.name}</span>
                        <span className="text-muted-foreground ml-2 font-mono text-xs">
                          {t.slug}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[t.status] ?? "outline"}
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link to={`/admin/tenants/${t.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
