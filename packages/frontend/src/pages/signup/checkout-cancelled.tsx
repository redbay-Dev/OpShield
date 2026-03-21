import { XCircle } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@frontend/components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";

export function CheckoutCancelledPage(): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
          <XCircle className="size-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-xl">Payment not completed</CardTitle>
        <CardDescription>
          Your payment was cancelled. No charges have been made.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button className="w-full" asChild>
          <Link to="/signup/review">Try Again</Link>
        </Button>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/">Back to Home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
