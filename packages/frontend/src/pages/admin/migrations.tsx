import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Database,
  Server,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import { toast } from "sonner";
import {
  useMigrationDashboard,
  useMigrationLog,
  useTriggerMigration,
} from "@frontend/api/migration-state.js";
import type { MigrationTenantState } from "@frontend/api/migration-state.js";

function StatusIcon({ status }: { status: string }): React.JSX.Element {
  switch (status) {
    case "current":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "behind":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
    current: "default",
    behind: "secondary",
    failed: "destructive",
  };
  return (
    <Badge variant={variants[status] ?? "outline"} className="text-xs">
      {status}
    </Badge>
  );
}

export function MigrationsPage(): React.JSX.Element {
  const { data, isLoading } = useMigrationDashboard();
  const { data: logs } = useMigrationLog();
  const triggerMutation = useTriggerMigration();
  const [productFilter, setProductFilter] = useState<string>("all");

  function handleTrigger(productId: string): void {
    triggerMutation.mutate(
      { productId },
      {
        onSuccess: () => {
          toast.success(`Migration triggered for ${productId}`);
        },
        onError: (err) => {
          toast.error(`Failed to trigger: ${err.message}`);
        },
      },
    );
  }

  const filteredStates = data?.states.filter(
    (s) => productFilter === "all" || s.state.productId === productFilter,
  ) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Database Migrations</h1>
        <p className="text-muted-foreground">
          Migration state across all products and tenants (auto-refreshes every 30s)
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Clock className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {/* Product Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {data?.products.map((product) => {
              const summary = data.summary[product.productId as keyof typeof data.summary];
              return (
                <Card key={product.productId}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-lg font-semibold capitalize">
                        <Server className="mr-2 inline h-5 w-5" />
                        {product.productId}
                      </CardTitle>
                      <CardDescription>
                        Latest: {product.latestVersion ?? "unknown"} ({product.totalMigrations} migrations)
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTrigger(product.productId)}
                      disabled={triggerMutation.isPending}
                    >
                      <RefreshCw className={`mr-1 h-4 w-4 ${triggerMutation.isPending ? "animate-spin" : ""}`} />
                      Trigger Migrate
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {summary ? (
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>{summary.current} current</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          <span>{summary.behind} behind</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span>{summary.failed} failed</span>
                        </div>
                        <div className="text-muted-foreground ml-auto">
                          {summary.total} tenant{summary.total !== 1 ? "s" : ""}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No state reported yet</p>
                    )}
                    {product.lastReportedAt && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Last reported: {new Date(product.lastReportedAt).toLocaleString("en-AU")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Per-Tenant State Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Tenant Migration State
                </CardTitle>
                <CardDescription>
                  Per-tenant migration version for each product
                </CardDescription>
              </div>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="nexum">Nexum</SelectItem>
                  <SelectItem value="safespec">SafeSpec</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Schema</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-center">Applied</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Migrated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
                        No migration state reported yet. Run migrations in each product to populate.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStates.map((row: MigrationTenantState) => (
                      <TableRow key={row.state.id}>
                        <TableCell className="font-medium">
                          {row.tenantName ?? row.state.tenantId.slice(0, 8)}
                          {row.tenantSlug && (
                            <span className="text-muted-foreground ml-1 text-xs">({row.tenantSlug})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {row.state.productId}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.state.schemaName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.state.currentVersion?.replace(".sql", "") ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.state.appliedCount}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <StatusIcon status={row.state.status} />
                            <StatusBadge status={row.state.status} />
                          </div>
                          {row.state.error && (
                            <p className="mt-1 text-xs text-red-500 max-w-xs truncate" title={row.state.error}>
                              {row.state.error}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.state.lastMigratedAt
                            ? new Date(row.state.lastMigratedAt).toLocaleString("en-AU")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Migration Log */}
          <Card>
            <CardHeader>
              <CardTitle>Migration Log</CardTitle>
              <CardDescription>Recent migration events and state reports</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Tenants</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logs ?? []).slice(0, 20).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(log.createdAt).toLocaleString("en-AU")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {log.productId}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.action.replace(/_/g, " ")}</TableCell>
                      <TableCell>{log.tenantsAffected}</TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                        {log.summary ? JSON.stringify(log.summary) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
