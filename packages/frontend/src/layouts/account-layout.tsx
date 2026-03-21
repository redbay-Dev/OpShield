import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import {
  User,
  CreditCard,
  Building2,
  Bell,
  Shield,
  Menu,
  LogOut,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
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

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/account", icon: Building2 },
  { label: "Profile", href: "/account/profile", icon: User },
  { label: "Billing", href: "/account/billing", icon: CreditCard },
  { label: "Notifications", href: "/account/notifications", icon: Bell },
];

function SidebarContent(): React.JSX.Element {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-4">
      <div className="mb-2 flex items-center gap-2 px-2">
        <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md">
          <Shield className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold">My Account</span>
      </div>
      <Separator className="mb-4" />
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === "/account"}
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

export function AccountLayout(): React.JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
    void navigate("/auth/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar border-sidebar-border hidden w-64 flex-col border-r lg:flex">
        <SidebarContent />
        <div className="border-t p-4">
          <NavLink
            to="/"
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </NavLink>
        </div>
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
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <div className="hidden lg:block" />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <span className="text-sm">
                    {session?.user.name ?? session?.user.email ?? "User"}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
