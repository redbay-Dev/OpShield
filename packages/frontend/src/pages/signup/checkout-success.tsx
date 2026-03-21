import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@frontend/components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";

export function CheckoutSuccessPage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="size-6 text-green-700" />
        </div>
        <CardTitle className="text-xl">Welcome to Nexum!</CardTitle>
        <CardDescription>
          Your account has been set up successfully. Your workspace is being provisioned now.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Setting up your workspace...
        </div>

        <p className="text-center text-sm text-muted-foreground">
          This usually takes less than a minute. You&apos;ll receive an email when everything is ready.
        </p>

        {sessionId && (
          <p className="text-center text-xs text-muted-foreground">
            Reference: {sessionId.slice(0, 20)}...
          </p>
        )}

        <div className="mt-2 space-y-2">
          <Button className="w-full" asChild>
            <Link to="/account">
              Go to My Account
              <ArrowRight />
            </Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
