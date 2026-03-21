import { useState } from "react";
import { Clock, Filter } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
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
import { useAuditLog } from "@frontend/hooks/use-audit-log.js";

const ALL_VALUE = "__all__";

const RESOURCE_TYPES = [
  "tenant",
  "tenant_module",
  "subscription",
  "invoice",
  "provisioning",
  "service_key",
];

const ACTION_BADGES: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "tenant.created": "default",
  "tenant.updated": "secondary",
  "module.added": "default",
  "module.updated": "secondary",
  "module.removed": "destructive",
  "subscription.created": "default",
  "subscription.cancelled": "destructive",
  "provisioning.success": "default",
  "provisioning.failed": "destructive",
};

export function AuditLogPage(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>(ALL_VALUE);
  const [resourceIdSearch, setResourceIdSearch] = useState("");

  const { data, isLoading } = useAuditLog({
    page,
    limit: 50,
    resourceType: resourceTypeFilter !== ALL_VALUE ? resourceTypeFilter : undefined,
    resourceId: resourceIdSearch || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Immutable record of all platform admin actions
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="text-muted-foreground h-4 w-4" />
        <Select
          value={resourceTypeFilter}
          onValueChange={(v) => { setResourceTypeFilter(v); setPage(1); }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Resource type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All resources</SelectItem>
            {RESOURCE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Resource ID..."
          value={resourceIdSearch}
          onChange={(e) => { setResourceIdSearch(e.target.value); setPage(1); }}
          className="w-[300px]"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Audit Trail
            {data && (
              <Badge variant="secondary" className="text-xs">
                {data.total} entries
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : data?.items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No audit log entries found
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Resource ID</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge
                          variant={ACTION_BADGES[entry.action] ?? "outline"}
                          className="text-xs"
                        >
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {entry.resourceType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">
                          {entry.resourceId
                            ? `${entry.resourceId.slice(0, 8)}...`
                            : "—"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {entry.actorType}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        <code className="text-muted-foreground text-xs" title={JSON.stringify(entry.metadata)}>
                          {Object.keys(entry.metadata).length > 0
                            ? JSON.stringify(entry.metadata).slice(0, 60)
                            : "—"}
                        </code>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data && data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
