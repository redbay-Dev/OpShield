import { Clock, TrendingUp, Users, DollarSign, BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";
import { useRevenueAnalytics } from "@frontend/hooks/use-analytics.js";

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function RevenuePage(): React.JSX.Element {
  const { data, isLoading } = useRevenueAnalytics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Revenue</h1>
        <p className="text-muted-foreground">
          Monthly recurring revenue and tenant analytics
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.mrr ?? 0)}
            </div>
            <p className="text-muted-foreground text-xs">Monthly recurring revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.activeTenants ?? 0}</div>
            <p className="text-muted-foreground text-xs">
              of {data?.tenantCounts?.total ?? 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.churnRate ?? 0}%</div>
            <p className="text-muted-foreground text-xs">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARPU</CardTitle>
            <BarChart3 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.arpu ?? 0)}
            </div>
            <p className="text-muted-foreground text-xs">Avg revenue per tenant</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {data?.tenantCounts &&
              Object.entries(data.tenantCounts)
                .filter(([key]) => key !== "total")
                .map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {status}
                    </Badge>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue by Product */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Product</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.revenueByProduct.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No revenue data yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.revenueByProduct.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.productId}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Module</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.revenueByModule.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No revenue data yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.revenueByModule.map((item) => (
                    <TableRow key={item.moduleId}>
                      <TableCell>
                        <code className="text-xs">{item.moduleId}</code>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
