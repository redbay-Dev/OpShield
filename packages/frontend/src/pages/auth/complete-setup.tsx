import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Eye, EyeOff } from "lucide-react";
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
import { apiPost } from "@frontend/api/client.js";

/**
 * Forced account setup page for the bootstrap admin.
 * Just name + new password. The admin already proved identity by logging in.
 */
export function CompleteSetupPage(): React.JSX.Element {
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const queryClient = useQueryClient();

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 10) {
      setError("New password must be at least 10 characters");
      return;
    }

    setLoading(true);

    // Step 1: Update name
    const nameResult = await authClient.updateUser({ name });
    if (nameResult.error) {
      setError(nameResult.error.message ?? "Failed to update name");
      setLoading(false);
      return;
    }

    // Step 2: Change password — currentPassword is the bootstrap default "admin"
    const pwResult = await authClient.changePassword({
      currentPassword: "admin",
      newPassword,
      revokeOtherSessions: false,
    });

    if (pwResult.error) {
      setError(pwResult.error.message ?? "Failed to change password");
      setLoading(false);
      return;
    }

    // Step 3: Clear the mustChangePassword flag
    await apiPost("/me/complete-setup", {});

    // Invalidate security status cache so ProtectedRoute sees updated state
    void queryClient.invalidateQueries({ queryKey: ["security-status"] });

    window.location.href = "/auth/2fa-setup";
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Complete Account Setup</CardTitle>
          <CardDescription>
            Set your name and a secure password to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} autoComplete="off">
            <FieldGroup>
              {error && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                  {error}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="name">Your Name</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-password">Password</FieldLabel>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="one-time-code"
                    minLength={10}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 h-full px-3"
                    onClick={() => setShowNewPw(!showNewPw)}
                    tabIndex={-1}
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <FieldDescription>Minimum 10 characters</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">
                  Confirm Password
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="one-time-code"
                    minLength={10}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 h-full px-3"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    tabIndex={-1}
                  >
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && (
                    <Loader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  )}
                  Save & Continue
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
