import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@frontend/components/ui/field.js";
import { Input } from "@frontend/components/ui/input.js";
import { authClient } from "@frontend/lib/auth-client.js";

export function LoginPage(): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Store redirect target so the 2FA verify page knows where to go
    // (window.location.href in onTwoFactorRedirect loses React Router state)
    sessionStorage.setItem("auth_redirect", from);

    const result = await authClient.signIn.email(
      { email, password },
      {
        onError: (ctx) => {
          setError(ctx.error.message ?? "Sign in failed");
          setLoading(false);
        },
      },
    );

    if (result.error) {
      setError(result.error.message ?? "Sign in failed");
      setLoading(false);
      return;
    }

    // If 2FA is required, the twoFactorClient plugin already triggered
    // onTwoFactorRedirect — don't override that navigation.
    if (result.data && "twoFactorRedirect" in result.data) {
      return;
    }

    // Full page navigation ensures cookies are picked up by subsequent requests.
    // React Router's navigate() can race with cookie storage, causing
    // ProtectedRoute to see a stale (unauthenticated) session.
    window.location.href = from;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your platform admin account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <FieldGroup>
              {error && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                  {error}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com.au"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  )}
                  Sign In
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{" "}
                  <Link to="/auth/sign-up">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
