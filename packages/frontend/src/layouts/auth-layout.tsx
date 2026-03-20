import { Outlet } from "react-router";
import { Shield } from "lucide-react";

export function AuthLayout(): React.JSX.Element {
  return (
    <div className="bg-muted flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-lg">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">OpShield</h1>
          <p className="text-muted-foreground text-sm">
            Redbay Platform Administration
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
