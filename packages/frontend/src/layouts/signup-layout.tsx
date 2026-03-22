import { Outlet, Link, useLocation } from "react-router";
import { Shield } from "lucide-react";
import { SignupProvider } from "@frontend/pages/signup/signup-context.js";
import { cn } from "@frontend/lib/utils.js";

const STEPS = [
  { path: "/signup", label: "Account" },
  { path: "/signup/2fa-setup", label: "Security" },
  { path: "/signup/company", label: "Company" },
  { path: "/signup/plan", label: "Plan" },
  { path: "/signup/review", label: "Review" },
] as const;

/** Steps that need a wider layout */
const WIDE_STEPS = new Set(["/signup/plan", "/signup/review"]);

function StepIndicator(): React.JSX.Element {
  const location = useLocation();

  const currentIndex = STEPS.findIndex((s) => s.path === location.pathname);
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step.path} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                i < activeIndex && "bg-primary text-primary-foreground",
                i === activeIndex && "bg-primary text-primary-foreground",
                i > activeIndex && "border bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "hidden text-sm sm:inline",
                i === activeIndex ? "font-medium" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "h-px w-4 sm:w-8",
                i < activeIndex ? "bg-primary" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function SignupLayout(): React.JSX.Element {
  const location = useLocation();
  const isWide = WIDE_STEPS.has(location.pathname);

  return (
    <SignupProvider>
      <div className="flex min-h-svh flex-col bg-muted">
        {/* Header */}
        <header className="border-b bg-background">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Shield className="size-4" />
              </div>
              <span>Nexum</span>
            </Link>
          </div>
        </header>

        {/* Step indicator */}
        <div className="border-b bg-background py-3">
          <div className="mx-auto max-w-3xl px-4">
            <StepIndicator />
          </div>
        </div>

        {/* Content */}
        <main
          className={cn(
            "mx-auto w-full flex-1 px-4 py-8",
            isWide ? "max-w-3xl" : "max-w-lg",
          )}
        >
          <Outlet />
        </main>
      </div>
    </SignupProvider>
  );
}
