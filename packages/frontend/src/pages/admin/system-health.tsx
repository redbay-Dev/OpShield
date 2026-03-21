import { Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { useSystemHealth } from "@frontend/hooks/use-system-health.js";
import type { ServiceHealth } from "@frontend/api/system-health.js";

function StatusIcon({ status }: { status: ServiceHealth["status"] }): React.JSX.Element {
  switch (status) {
    case "ok":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "unreachable":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "error":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  }
}

function StatusBadge({ status }: { status: ServiceHealth["status"] }): React.JSX.Element {
  const variants: Record<string, "default" | "destructive" | "secondary"> = {
    ok: "default",
    unreachable: "destructive",
    error: "secondary",
  };
  return (
    <Badge variant={variants[status] ?? "secondary"} className="text-xs">
      {status}
    </Badge>
  );
}

export function SystemHealthPage(): React.JSX.Element {
  const { data, isLoading } = useSystemHealth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
        <p className="text-muted-foreground">
          Real-time status of all platform services (auto-refreshes every 30s)
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Clock className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {data?.services.map((service) => (
              <Card key={service.name}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {service.name}
                  </CardTitle>
                  <StatusIcon status={service.status} />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={service.status} />
                    <span className="text-muted-foreground text-xs">
                      {service.responseTimeMs}ms
                    </span>
                  </div>
                  {service.details && (
                    <div className="mt-2 space-y-1">
                      {"version" in service.details && service.details.version != null && (
                        <p className="text-muted-foreground text-xs">
                          {"Version: " + String(service.details.version)}
                        </p>
                      )}
                      {"database" in service.details && service.details.database != null && (
                        <p className="text-muted-foreground text-xs">
                          {"DB: " + String(service.details.database)}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {data?.checkedAt && (
            <p className="text-muted-foreground text-xs">
              Last checked: {new Date(data.checkedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
