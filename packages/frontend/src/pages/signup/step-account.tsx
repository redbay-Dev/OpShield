import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Field, FieldGroup, FieldLabel } from "@frontend/components/ui/field.js";
import { Input } from "@frontend/components/ui/input.js";
import { authClient } from "@frontend/lib/auth-client.js";
import { useSignupContext } from "./signup-context.js";

export function StepAccountPage(): React.JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAccountCreated, setBillingEmail } = useSignupContext();

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    await authClient.signUp.email(
      { name, email, password },
      {
        onSuccess: () => {
          setAccountCreated(true);
          setBillingEmail(email);
          void navigate("/signup/2fa-setup", { replace: true });
        },
        onError: (ctx) => {
          setError(ctx.error.message ?? "Sign up failed");
          setLoading(false);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Get started with Nexum in minutes
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
                placeholder="John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="john@company.com.au"
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
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
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
                {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
                Create Account
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/auth/login" className="underline underline-offset-4 hover:text-foreground">
                  Sign in
                </Link>
              </p>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
