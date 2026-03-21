import { useState, type FormEvent } from "react";
import { Loader2, User, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Separator } from "@frontend/components/ui/separator.js";
import { authClient } from "@frontend/lib/auth-client.js";
import { useLogoutEverywhere } from "@frontend/hooks/use-account.js";
import { toast } from "sonner";

export function ProfilePage(): React.JSX.Element {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const logoutAll = useLogoutEverywhere();

  const [name, setName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameInitialized, setNameInitialized] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Initialize name from session once loaded
  if (session?.user.name && !nameInitialized) {
    setName(session.user.name);
    setNameInitialized(true);
  }

  async function handleUpdateName(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) return;

    setNameLoading(true);
    try {
      await authClient.updateUser({ name: name.trim() });
      toast.success("Name updated");
    } catch {
      toast.error("Failed to update name");
    } finally {
      setNameLoading(false);
    }
  }

  async function handleChangePassword(e: FormEvent): Promise<void> {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setPasswordLoading(true);
    try {
      await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Failed to change password — check your current password");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleLogoutEverywhere(): Promise<void> {
    try {
      await logoutAll.mutateAsync();
      toast.success("Logged out of all sessions across all products");
    } catch {
      toast.error("Failed to logout everywhere");
    }
  }

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account details and security
        </p>
      </div>

      {/* Profile info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Personal Information</CardTitle>
          </div>
          <CardDescription>Update your name and email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={session?.user.email ?? ""}
              disabled
              className="bg-muted"
            />
            <p className="text-muted-foreground text-xs">
              Email cannot be changed here — contact support if needed
            </p>
          </div>
          <form onSubmit={(e) => void handleUpdateName(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <Button type="submit" disabled={nameLoading || !name.trim()}>
              {nameLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Save Name
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            <CardTitle>Change Password</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => void handleChangePassword(e)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={passwordLoading || !currentPassword || !newPassword}
            >
              {passwordLoading && (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              )}
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 2FA Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Two-Factor Authentication</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant="default">Enabled</Badge>
            <p className="text-muted-foreground text-sm">
              2FA is mandatory for all OpShield accounts
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Session management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            <CardTitle>Sessions</CardTitle>
          </div>
          <CardDescription>
            Log out of all sessions across OpShield, SafeSpec, and Nexum
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => void handleLogoutEverywhere()}
            disabled={logoutAll.isPending}
          >
            {logoutAll.isPending && (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            )}
            Log Out Everywhere
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
