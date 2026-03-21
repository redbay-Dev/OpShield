import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Copy, Check } from "lucide-react";
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

type SetupStep = "password" | "scan" | "verify" | "backup";

export function StepTwoFactorPage(): React.JSX.Element {
  const [step, setStep] = useState<SetupStep>("password");
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { setTwoFactorComplete } = useSignupContext();

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

  function handleContinue(): void {
    setTwoFactorComplete(true);
    void navigate("/signup/company", { replace: true });
  }

  const secret = totpUri
    ? new URL(totpUri).searchParams.get("secret") ?? ""
    : "";

  if (step === "password") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Set up two-factor authentication</CardTitle>
          <CardDescription>
            2FA is required for all accounts. Enter your password to begin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleEnable(e)}>
            <FieldGroup>
              {error && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                  {error}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  Continue
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step === "scan") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Scan QR code</CardTitle>
          <CardDescription>
            Scan with your authenticator app (Google Authenticator, Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex justify-center">
            <div className="rounded-lg border bg-white p-4">
              <QRCodeSVG value={totpUri} size={200} />
            </div>
          </div>
          {secret && (
            <div className="flex flex-col gap-2">
              <p className="text-center text-xs text-muted-foreground">Or enter this key manually:</p>
              <p className="break-all rounded-md bg-muted p-2 text-center font-mono text-sm select-all">
                {secret}
              </p>
            </div>
          )}
          <Button className="w-full" onClick={() => setStep("verify")}>
            I&apos;ve scanned the code
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "verify") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Verify code</CardTitle>
          <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
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
                <FieldLabel htmlFor="code">Verification Code</FieldLabel>
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
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  Verify & Enable 2FA
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("scan")}>
                  Back to QR code
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Backup codes step
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Save backup codes</CardTitle>
        <CardDescription>
          Store these in a safe place. Each code can be used once if you lose your authenticator.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-4">
          {backupCodes.map((backupCode) => (
            <p key={backupCode} className="text-center font-mono text-sm">{backupCode}</p>
          ))}
        </div>
        <Button variant="outline" className="w-full" onClick={handleCopyBackupCodes}>
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied!" : "Copy backup codes"}
        </Button>
        <Button className="w-full" onClick={handleContinue}>
          Continue to Company Setup
        </Button>
      </CardContent>
    </Card>
  );
}
