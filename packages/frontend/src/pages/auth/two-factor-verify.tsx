import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { authClient } from "@frontend/lib/auth-client.js";

export function TwoFactorVerifyPage(): React.JSX.Element {
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

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

    void navigate(from, { replace: true });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {useBackup ? "Backup Code" : "Two-Factor Verification"}
        </CardTitle>
        <CardDescription>
          {useBackup
            ? "Enter one of your backup codes"
            : "Enter the 6-digit code from your authenticator app"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={(e) => void handleVerify(e)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="code">
              {useBackup ? "Backup Code" : "Verification Code"}
            </Label>
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
          </div>
          {!useBackup && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Trust this device for 30 days</span>
            </label>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            {useBackup ? "Use authenticator app" : "Use a backup code"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
