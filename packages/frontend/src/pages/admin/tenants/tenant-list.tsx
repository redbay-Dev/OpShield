import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";
import { useTenants } from "@frontend/hooks/use-tenants.js";
import { CreateTenantDialog } from "./create-tenant-dialog.js";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  onboarding: "secondary",
  suspended: "destructive",
  cancelled: "outline",
};

export function TenantListPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const page = Number(searchParams.get("page") ?? "1");
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const params = useMemo(
    () => ({ page, status, search, limit: 20 }),
    [page, status, search],
  );
  const { data, isPending } = useTenants(params);

  function handleSearch(value: string): void {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set("search", value);
    } else {
      next.delete("search");
    }
    next.set("page", "1");
    setSearchParams(next);
  }

  function handleStatusFilter(value: string): void {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set("status", value);
    } else {
      next.delete("status");
    }
    next.set("page", "1");
    setSearchParams(next);
  }

  function handlePageChange(newPage: number): void {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(newPage));
    setSearchParams(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground">
            Manage platform tenants and their subscriptions
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Tenant
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search tenants..."
            defaultValue={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={status ?? ""}
          onChange={(e) => handleStatusFilter(e.target.value)}
          className="border-input bg-background ring-offset-background rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      {isPending ? (
        <div className="flex justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billing Email</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground py-12 text-center"
                    >
                      No tenants found
                    </TableCell>
                  </TableRow>
                )}
                {data?.items.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer"
                    onClick={() => void navigate(`/admin/tenants/${tenant.id}`)}
                  >
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {tenant.slug}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[tenant.status] ?? "outline"}
                      >
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{tenant.billingEmail ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Showing {(page - 1) * params.limit + 1}–
                {Math.min(page * params.limit, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <CreateTenantDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
