import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Button } from "@frontend/components/ui/button.js";
import { Separator } from "@frontend/components/ui/separator.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import {
  useAdminTicketDetail,
  useUpdateTicket,
  useAddAdminMessage,
} from "@frontend/hooks/use-support.js";
import { ArrowLeft, ExternalLink, Send, StickyNote } from "lucide-react";
import { toast } from "sonner";

const PRODUCT_LABELS: Record<string, string> = {
  safespec: "SafeSpec",
  nexum: "Nexum",
  opshield: "OpShield",
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_customer", label: "Waiting (Customer)" },
  { value: "waiting_on_internal", label: "Waiting (Internal)" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SupportTicketDetailPage(): React.JSX.Element {
  const { ticketNumber } = useParams<{ ticketNumber: string }>();
  const navigate = useNavigate();
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading } = useAdminTicketDetail(ticketNumber ?? "");
  const updateMutation = useUpdateTicket(ticketNumber ?? "");
  const messageMutation = useAddAdminMessage(ticketNumber ?? "");

  function handleStatusChange(status: string): void {
    updateMutation.mutate(
      { status: status as "open" | "in_progress" | "waiting_on_customer" | "waiting_on_internal" | "resolved" | "closed" },
      {
        onSuccess: () => toast.success("Status updated"),
        onError: () => toast.error("Failed to update status"),
      },
    );
  }

  function handlePriorityChange(priority: string): void {
    updateMutation.mutate(
      { priority: priority as "low" | "medium" | "high" | "urgent" },
      {
        onSuccess: () => toast.success("Priority updated"),
        onError: () => toast.error("Failed to update priority"),
      },
    );
  }

  function handleSendReply(): void {
    if (!replyText.trim()) return;

    messageMutation.mutate(
      { body: replyText, isInternalNote: isInternal },
      {
        onSuccess: () => {
          setReplyText("");
          setIsInternal(false);
          toast.success(isInternal ? "Internal note added" : "Reply sent");
        },
        onError: () => toast.error("Failed to send"),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="text-muted-foreground py-12 text-center">Loading...</div>
    );
  }

  if (!ticket) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Ticket not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => void navigate("/admin/support")}
        >
          Back to tickets
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigate("/admin/support")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-sm">
              {ticket.ticketNumber}
            </span>
            <Badge
              variant={
                ticket.priority === "urgent" || ticket.priority === "high"
                  ? "destructive"
                  : "secondary"
              }
            >
              {ticket.priority}
            </Badge>
          </div>
          <h1 className="text-xl font-bold">{ticket.subject}</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content — conversation */}
        <div className="space-y-4 lg:col-span-2">
          {/* Conversation thread */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg border p-4 ${
                    msg.isInternalNote
                      ? "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"
                      : msg.senderType === "admin"
                        ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"
                        : "bg-muted/50"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {msg.senderName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs"
                      >
                        {msg.isInternalNote
                          ? "Internal Note"
                          : msg.senderType === "admin"
                            ? "Admin"
                            : "Customer"}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Reply box */}
          <Card>
            <CardContent className="pt-6">
              <textarea
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[120px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                placeholder={
                  isInternal
                    ? "Add an internal note (not visible to customer)..."
                    : "Type your reply..."
                }
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <div className="mt-3 flex items-center justify-between">
                <Button
                  variant={isInternal ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setIsInternal(!isInternal)}
                >
                  <StickyNote className="mr-1 h-4 w-4" />
                  {isInternal ? "Internal Note" : "Customer Reply"}
                </Button>
                <Button
                  size="sm"
                  disabled={!replyText.trim() || messageMutation.isPending}
                  onClick={handleSendReply}
                >
                  <Send className="mr-1 h-4 w-4" />
                  {isInternal ? "Add Note" : "Send Reply"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar — context + controls */}
        <div className="space-y-4">
          {/* Context card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Product</span>
                <span className="font-medium">
                  {PRODUCT_LABELS[ticket.productId] ?? ticket.productId}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenant</span>
                <div className="flex items-center gap-1">
                  <span className="font-medium">
                    {ticket.tenantName ?? "—"}
                  </span>
                  {ticket.tenantId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() =>
                        void navigate(`/admin/tenants/${ticket.tenantId}`)
                      }
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenant Status</span>
                <span>{ticket.tenantStatus ?? "—"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">User</span>
                <span>{ticket.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="truncate text-xs">{ticket.userEmail}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span>{ticket.category.replace(/_/g, " ")}</span>
              </div>
              {ticket.pageUrl && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground">Page URL</span>
                    <p className="mt-1 truncate font-mono text-xs">
                      {ticket.pageUrl}
                    </p>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted</span>
                <span className="text-xs">{formatDate(ticket.createdAt)}</span>
              </div>
              {ticket.firstResponseAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">First Response</span>
                  <span className="text-xs">
                    {formatDate(ticket.firstResponseAt)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controls card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  Status
                </label>
                <Select
                  value={ticket.status}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  Priority
                </label>
                <Select
                  value={ticket.priority}
                  onValueChange={handlePriorityChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {ticket.tags.length > 0 && (
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs font-medium">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {ticket.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
