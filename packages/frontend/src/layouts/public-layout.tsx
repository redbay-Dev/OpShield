import { Outlet, Link, useNavigate } from "react-router";
import { Shield, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@frontend/components/ui/button.js";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@frontend/components/ui/sheet.js";
import { Separator } from "@frontend/components/ui/separator.js";
import { authClient } from "@frontend/lib/auth-client.js";

const NAV_LINKS = [
  { label: "Pricing", to: "/pricing" },
] as const;

function NavItems({ onClick }: { onClick?: () => void }): React.JSX.Element {
  return (
    <>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          onClick={onClick}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

export function PublicLayout(): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  return (
    <div className="flex min-h-svh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Shield className="size-4" />
              </div>
              <span>Redbay</span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              <NavItems />
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {session ? (
              <Button variant="outline" size="sm" onClick={() => void navigate("/admin")}>
                Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => void navigate("/auth/login")}>
                  Sign In
                </Button>
                <Button size="sm" onClick={() => void navigate("/signup")}>
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon-sm">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col gap-4 pt-6">
                <NavItems onClick={() => setMobileOpen(false)} />
                <Separator />
                {session ? (
                  <Button variant="outline" size="sm" onClick={() => { setMobileOpen(false); void navigate("/admin"); }}>
                    Dashboard
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => { setMobileOpen(false); void navigate("/auth/login"); }}>
                      Sign In
                    </Button>
                    <Button size="sm" onClick={() => { setMobileOpen(false); void navigate("/signup"); }}>
                      Get Started
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="size-4" />
              <span>&copy; {new Date().getFullYear()} Redbay Development Pty Ltd</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
