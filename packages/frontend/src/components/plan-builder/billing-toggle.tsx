import { Tabs, TabsList, TabsTrigger } from "@frontend/components/ui/tabs";
import { Badge } from "@frontend/components/ui/badge";

interface BillingToggleProps {
  value: "monthly" | "annual";
  onChange: (value: "monthly" | "annual") => void;
}

export function BillingToggle({
  value,
  onChange,
}: BillingToggleProps): React.JSX.Element {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as "monthly" | "annual")}
    >
      <TabsList className="mx-auto">
        <TabsTrigger value="monthly">Monthly</TabsTrigger>
        <TabsTrigger value="annual" className="gap-2">
          Annual
          <Badge variant="secondary" className="text-xs font-normal">
            Save 2 months
          </Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
