import { useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router";
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
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@frontend/components/ui/field.js";
import { Input } from "@frontend/components/ui/input.js";
import { useSignupContext } from "./signup-context.js";
import { useCheckSlug } from "@frontend/hooks/use-signup.js";
import { ArrowLeft, ArrowRight } from "lucide-react";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function StepCompanyPage(): React.JSX.Element {
  const navigate = useNavigate();
  const ctx = useSignupContext();
  const slugToCheck = ctx.companySlug;
  const { data: slugAvailable, isLoading: slugChecking } = useCheckSlug(
    slugToCheck,
    slugToCheck.length >= 2,
  );

  // Auto-generate slug from company name
  useEffect(() => {
    if (ctx.companyName) {
      ctx.setCompanySlug(slugify(ctx.companyName));
    }
  }, [ctx.companyName]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    void navigate("/signup/plan");
  }

  const canProceed =
    ctx.companyName.length >= 2 &&
    ctx.companySlug.length >= 2 &&
    ctx.billingEmail.length > 0 &&
    slugAvailable !== false;

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>Tell us about your business</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="company-name">Company Name</FieldLabel>
                <Input
                  id="company-name"
                  value={ctx.companyName}
                  onChange={(e) => ctx.setCompanyName(e.target.value)}
                  placeholder="Smith Haulage Pty Ltd"
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="company-slug">URL Slug</FieldLabel>
                <Input
                  id="company-slug"
                  value={ctx.companySlug}
                  onChange={(e) =>
                    ctx.setCompanySlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    )
                  }
                  placeholder="smith-haulage"
                  required
                />
                <FieldDescription>
                  {slugChecking && "Checking availability..."}
                  {!slugChecking &&
                    slugAvailable === true &&
                    ctx.companySlug.length >= 2 &&
                    "Available"}
                  {!slugChecking &&
                    slugAvailable === false &&
                    "This slug is already taken"}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="billing-email">Billing Email</FieldLabel>
                <Input
                  id="billing-email"
                  type="email"
                  value={ctx.billingEmail}
                  onChange={(e) => ctx.setBillingEmail(e.target.value)}
                  placeholder="accounts@company.com.au"
                  required
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void navigate("/signup/2fa-setup")}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <Button type="submit" disabled={!canProceed}>
            Choose Plan
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
