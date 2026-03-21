import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Building2,
  Webhook,
  ScrollText,
  HeartPulse,
  TrendingUp,
  LifeBuoy,
  Menu,
  LogOut,
  User,
  Shield,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Separator } from "@frontend/components/ui/separator.js";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@frontend/components/ui/sheet.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@frontend/components/ui/dropdown-menu.js";
import { cn } from "@frontend/lib/utils.js";
import { authClient } from "@frontend/lib/auth-client.js";
import { useAdminPermissions } from "@frontend/hooks/use-admin-permissions.js";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Tenants", href: "/admin/tenants", icon: Building2 },
  { label: "Webhook Log", href: "/admin/webhook-log", icon: Webhook },
  { label: "Revenue", href: "/admin/revenue", icon: TrendingUp },
  { label: "Support", href: "/admin/support", icon: LifeBuoy },
  { label: "Audit Log", href: "/admin/audit-log", icon: ScrollText },
  { label: "System Health", href: "/admin/system-health", icon: HeartPulse },
  { label: "Platform Admins", href: "/admin/admins", icon: ShieldCheck },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  support: "Support",
  viewer: "Viewer",
};

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  support: "secondary",
  viewer: "outline",
};

function SidebarContent({ role }: { role: string | null }): React.JSX.Element {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-4">
      <div className="mb-2 flex items-center gap-2 px-2">
        <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md">
          <Shield className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold">OpShield</span>
      </div>
      {role && (
        <div className="mb-2 px-2">
          <Badge variant={ROLE_VARIANT[role] ?? "outline"} className="text-xs">
            {ROLE_LABELS[role] ?? role}
          </Badge>
        </div>
      )}
      <Separator className="mb-4" />
      <p className="text-muted-foreground mb-2 px-2 text-xs font-medium uppercase tracking-wider">
        Management
      </p>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === "/admin"}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function DashboardLayout(): React.JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const { role } = useAdminPermissions();
  const navigate = useNavigate();

  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
    void navigate("/auth/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar border-sidebar-border hidden w-64 flex-col border-r lg:flex">
        <SidebarContent role={role} />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="border-b px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between">
            {/* Mobile menu */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarContent role={role} />
              </SheetContent>
            </Sheet>

            <div className="hidden lg:block" />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <span className="text-sm">
                    {session?.user.name ?? session?.user.email ?? "Admin"}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void navigate("/account")}>
                  <User className="mr-2 h-4 w-4" />
                  My Account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleSignOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
