import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Copy, Check } from "lucide-react";
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

type SetupStep = "password" | "scan" | "verify" | "backup";

export function TwoFactorSetupPage(): React.JSX.Element {
  const [step, setStep] = useState<SetupStep>("password");
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  async function handleEnable(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await authClient.twoFactor.enable({ password });

    if (result.error) {
      setError(result.error.message ?? "Failed to enable 2FA");
      setLoading(false);
      return;
    }

    if (result.data) {
      setTotpUri(result.data.totpURI);
      setBackupCodes(result.data.backupCodes);
      setStep("scan");
    }
    setLoading(false);
  }

  async function handleVerify(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await authClient.twoFactor.verifyTotp({
      code,
      trustDevice: true,
    });

    if (result.error) {
      setError(result.error.message ?? "Invalid code");
      setLoading(false);
      return;
    }

    setStep("backup");
    setLoading(false);
  }

  function handleCopyBackupCodes(): void {
    void navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Extract the secret from the TOTP URI for manual entry
  const secret = totpUri
    ? new URL(totpUri).searchParams.get("secret") ?? ""
    : "";

  if (step === "password") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            2FA is required for all accounts. Enter your password to begin
            setup.
          </CardDescription>
        </CardHeader>
        <form onSubmit={(e) => void handleEnable(e)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  if (step === "scan") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan QR Code</CardTitle>
          <CardDescription>
            Scan this QR code with your authenticator app (Google Authenticator,
            Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div className="rounded-lg border bg-white p-4">
              <QRCodeSVG value={totpUri} size={200} />
            </div>
          </div>
          {secret && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-center text-xs">
                Or enter this key manually:
              </p>
              <p className="bg-muted break-all rounded-md p-2 text-center font-mono text-sm select-all">
                {secret}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => setStep("verify")}>
            I&apos;ve scanned the code
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (step === "verify") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify Code</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
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
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                className="text-center font-mono text-lg tracking-widest"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify & Enable 2FA
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep("scan")}
            >
              Back to QR code
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  // Backup codes step
  return (
    <Card>
      <CardHeader>
        <CardTitle>Save Backup Codes</CardTitle>
        <CardDescription>
          Store these codes in a safe place. Each code can be used once to sign
          in if you lose access to your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted grid grid-cols-2 gap-2 rounded-md p-4">
          {backupCodes.map((backupCode) => (
            <p key={backupCode} className="text-center font-mono text-sm">
              {backupCode}
            </p>
          ))}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleCopyBackupCodes}
        >
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? "Copied!" : "Copy backup codes"}
        </Button>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() => void navigate("/admin", { replace: true })}
        >
          Continue to Dashboard
        </Button>
      </CardFooter>
    </Card>
  );
}
