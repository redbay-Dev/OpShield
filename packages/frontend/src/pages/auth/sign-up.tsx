import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
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

export function SignUpPage(): React.JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    await authClient.signUp.email(
      { email, password, name },
      {
        onSuccess: () => {
          void navigate("/auth/2fa-setup", { replace: true });
        },
        onError: (ctx) => {
          setError(ctx.error.message ?? "Sign up failed");
          setLoading(false);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create account</CardTitle>
          <CardDescription>
            Set up your platform admin account
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
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ryan Stagg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  autoFocus
                />
              </Field>
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
                  autoComplete="new-password"
                  minLength={10}
                />
                <FieldDescription>Minimum 10 characters</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">
                  Confirm Password
                </FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={10}
                />
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && (
                    <Loader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  )}
                  Create Account
                </Button>
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <Link to="/auth/login">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
