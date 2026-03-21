import { Loader2, Bell } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@frontend/components/ui/card.js";
import { Label } from "@frontend/components/ui/label.js";
import { Checkbox } from "@frontend/components/ui/checkbox.js";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@frontend/hooks/use-account.js";
import { toast } from "sonner";

interface PreferenceItemProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  disabled: boolean;
}

function PreferenceItem({
  id,
  label,
  description,
  checked,
  onToggle,
  disabled,
}: PreferenceItemProps): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-md border p-4">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(val) => onToggle(val === true)}
        disabled={disabled}
      />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}

export function NotificationsPage(): React.JSX.Element {
  const { data: prefs, isPending } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  async function handleToggle(
    key: "billingEmails" | "supportEmails" | "productUpdates",
    value: boolean,
  ): Promise<void> {
    try {
      await update.mutateAsync({ [key]: value });
      toast.success("Preferences updated");
    } catch {
      toast.error("Failed to update preferences");
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Choose which emails you receive
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Email Preferences</CardTitle>
          </div>
          <CardDescription>
            Critical emails (payment failures, account suspension) are always
            sent regardless of these settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <PreferenceItem
            id="billing"
            label="Billing Emails"
            description="Invoice receipts, subscription confirmations, plan changes"
            checked={prefs?.billingEmails ?? true}
            onToggle={(val) => void handleToggle("billingEmails", val)}
            disabled={update.isPending}
          />
          <PreferenceItem
            id="support"
            label="Support Emails"
            description="Ticket updates, resolution notifications"
            checked={prefs?.supportEmails ?? true}
            onToggle={(val) => void handleToggle("supportEmails", val)}
            disabled={update.isPending}
          />
          <PreferenceItem
            id="product"
            label="Product Updates"
            description="New features, release notes, platform announcements"
            checked={prefs?.productUpdates ?? true}
            onToggle={(val) => void handleToggle("productUpdates", val)}
            disabled={update.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
