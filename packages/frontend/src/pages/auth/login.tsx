import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
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
import {
  buildPostAuthUrl,
  isExternalRedirect,
  storeRedirectTarget,
} from "@frontend/lib/sso-redirect.js";

/**
 * Login page.
 *
 * Handles two scenarios:
 *
 * 1. **OpShield admin login** — user navigates to /auth/login directly.
 *    After auth, redirects to /admin (or the internal path from location.state.from).
 *
 * 2. **Product SSO login** — a product (Nexum/SafeSpec) redirected here with
 *    ?redirect=<product_callback_url>. After auth, redirects through the
 *    backend SSO endpoint which issues a JWT and sends the user back to the product.
 *
 * If the user is ALREADY authenticated and arrives with ?redirect=, they are
 * redirected immediately without showing the login form (seamless SSO).
 */
export function LoginPage(): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // External redirect from a product (?redirect=<product_callback_url>)
  const externalRedirect = searchParams.get("redirect");

  // Internal redirect from ProtectedRoute (location.state.from)
  const internalFrom =
    (location.state as { from?: string } | null)?.from ?? "/admin";

  // The final redirect target after authentication
  const redirectTarget = externalRedirect ?? internalFrom;

  // If user is already authenticated and there's an external product redirect,
  // skip the login form and redirect immediately (seamless cross-product SSO).
  useEffect(() => {
    if (!externalRedirect) {
      return;
    }

    setCheckingSession(true);

    // Check if user already has a valid session
    authClient
      .getSession()
      .then((result) => {
        if (result.data) {
          // User is already authenticated — redirect to product via SSO endpoint
          window.location.href = buildPostAuthUrl(externalRedirect);
        } else {
          setCheckingSession(false);
        }
      })
      .catch(() => {
        setCheckingSession(false);
      });
  }, [externalRedirect]);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Store redirect target so the 2FA verify page knows where to go
    // (window.location.href in onTwoFactorRedirect loses React Router state)
    storeRedirectTarget(redirectTarget);

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
    // The 2FA verify page will read the redirect target from sessionStorage.
    if (result.data && "twoFactorRedirect" in result.data) {
      return;
    }

    // Full page navigation ensures cookies are picked up by subsequent requests.
    // For product redirects, this goes through the backend SSO endpoint.
    // For internal redirects, this navigates directly.
    window.location.href = buildPostAuthUrl(redirectTarget);
  }

  // Show loading state while checking for existing session (SSO passthrough)
  if (checkingSession) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground text-sm">
          Checking authentication...
        </p>
      </div>
    );
  }

  const isProductLogin = isExternalRedirect(redirectTarget);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            {isProductLogin
              ? "Sign in to continue to your application"
              : "Sign in to your platform admin account"}
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
