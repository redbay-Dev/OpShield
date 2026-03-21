import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Button } from "@frontend/components/ui/button.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";
import {
  useAdminTickets,
  useSupportStats,
} from "@frontend/hooks/use-support.js";
import {
  Inbox,
  Clock,
  PauseCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const PRIORITY_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  urgent: { variant: "destructive", label: "Urgent" },
  high: { variant: "destructive", label: "High" },
  medium: { variant: "secondary", label: "Medium" },
  low: { variant: "outline", label: "Low" },
};

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  open: { variant: "default", label: "Open" },
  in_progress: { variant: "secondary", label: "In Progress" },
  waiting_on_customer: { variant: "outline", label: "Waiting (Customer)" },
  waiting_on_internal: { variant: "outline", label: "Waiting (Internal)" },
  resolved: { variant: "secondary", label: "Resolved" },
  closed: { variant: "outline", label: "Closed" },
};

const PRODUCT_LABELS: Record<string, string> = {
  safespec: "SafeSpec",
  nexum: "Nexum",
  opshield: "OpShield",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d`;
}

export function SupportTicketsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("");

  const { data: stats } = useSupportStats();
  const { data, isLoading } = useAdminTickets({
    page,
    limit: 20,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    productId: productFilter || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
        <p className="text-muted-foreground text-sm">
          Manage support requests from all products
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open</CardTitle>
              <Inbox className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.openCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgressCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waiting</CardTitle>
              <PauseCircle className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.waitingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
              <CheckCircle2 className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.resolvedTodayCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="waiting_on_customer">Waiting (Customer)</SelectItem>
            <SelectItem value="waiting_on_internal">Waiting (Internal)</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="safespec">SafeSpec</SelectItem>
            <SelectItem value="nexum">Nexum</SelectItem>
            <SelectItem value="opshield">OpShield</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Priority</TableHead>
                <TableHead className="w-[80px]">#</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="w-[100px]">Product</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[60px] text-right">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    No tickets found
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((ticket) => {
                  const priorityInfo = PRIORITY_BADGE[ticket.priority] ?? { variant: "secondary" as const, label: ticket.priority };
                  const statusInfo = STATUS_BADGE[ticket.status] ?? { variant: "outline" as const, label: ticket.status };

                  return (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer"
                      onClick={() => void navigate(`/admin/support/${ticket.ticketNumber}`)}
                    >
                      <TableCell>
                        <Badge variant={priorityInfo.variant} className="text-xs">
                          {priorityInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {ticket.ticketNumber}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate font-medium">
                        {ticket.subject}
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          {PRODUCT_LABELS[ticket.productId] ?? ticket.productId}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ticket.tenantName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant} className="text-xs">
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-sm">
                        {timeAgo(ticket.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {data.total} ticket{data.total !== 1 ? "s" : ""} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
