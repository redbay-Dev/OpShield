import { useState, type FormEvent } from "react";
import { useLocation } from "react-router";
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

export function TwoFactorVerifyPage(): React.JSX.Element {
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  // Prefer sessionStorage (set by login page before 2FA redirect),
  // fall back to React Router state, then default to /admin
  const from =
    sessionStorage.getItem("auth_redirect") ??
    (location.state as { from?: string } | null)?.from ??
    "/admin";

  async function handleVerify(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });

    if (result.error) {
      setError(result.error.message ?? "Verification failed");
      setLoading(false);
      return;
    }

    sessionStorage.removeItem("auth_redirect");

    // Full page navigation ensures cookies are picked up by subsequent requests.
    // React Router's navigate() can race with cookie storage, causing
    // ProtectedRoute to see a stale (unauthenticated) session.
    window.location.href = from;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {useBackup ? "Backup code" : "Two-factor verification"}
          </CardTitle>
          <CardDescription>
            {useBackup
              ? "Enter one of your backup codes"
              : "Enter the 6-digit code from your authenticator app"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleVerify(e)}>
            <FieldGroup>
              {error && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                  {error}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="code">
                  {useBackup ? "Backup Code" : "Verification Code"}
                </FieldLabel>
                <Input
                  id="code"
                  type="text"
                  inputMode={useBackup ? "text" : "numeric"}
                  pattern={useBackup ? undefined : "[0-9]{6}"}
                  maxLength={useBackup ? 9 : 6}
                  placeholder={useBackup ? "xxxx-xxxx" : "000000"}
                  value={code}
                  onChange={(e) =>
                    setCode(
                      useBackup
                        ? e.target.value
                        : e.target.value.replace(/\D/g, ""),
                    )
                  }
                  required
                  autoFocus
                  className="text-center font-mono text-lg tracking-widest"
                />
              </Field>
              {!useBackup && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">
                    Trust this device for 30 days
                  </span>
                </label>
              )}
              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && (
                    <Loader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  )}
                  Verify
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setUseBackup(!useBackup);
                    setCode("");
                    setError("");
                  }}
                >
                  {useBackup
                    ? "Use authenticator app"
                    : "Use a backup code"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
