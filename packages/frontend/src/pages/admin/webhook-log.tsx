import { useState } from "react";
import { CheckCircle, XCircle, Clock, Filter } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import { useWebhookDeliveries } from "@frontend/hooks/use-webhook-deliveries.js";

const ALL_VALUE = "__all__";

function StatusIcon({ error }: { error: string | null }): React.JSX.Element {
  if (error === null) {
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  }
  return <XCircle className="h-4 w-4 text-red-500" />;
}

export function WebhookLogPage(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [productFilter, setProductFilter] = useState<string>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);

  const { data, isLoading } = useWebhookDeliveries({
    page,
    limit: 20,
    productId: productFilter !== ALL_VALUE ? productFilter : undefined,
    status: statusFilter !== ALL_VALUE ? statusFilter : undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Webhook Log</h1>
        <p className="text-muted-foreground">
          Outbound webhook delivery history to product backends
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="text-muted-foreground h-4 w-4" />
        <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All products</SelectItem>
            <SelectItem value="safespec">SafeSpec</SelectItem>
            <SelectItem value="nexum">Nexum</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Deliveries
            {data && (
              <Badge variant="secondary" className="text-xs">
                {data.total} total
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
              No webhook deliveries found
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">Status</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <StatusIcon error={d.error} />
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{d.eventType}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {d.productId}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {d.httpStatus ? (
                          <Badge
                            variant={d.httpStatus < 400 ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {d.httpStatus}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {d.error ? (
                          <span className="text-xs text-red-500" title={d.error}>
                            {d.error}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(d.createdAt).toLocaleString()}
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
