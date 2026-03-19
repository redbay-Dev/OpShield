Scaffold a new React component following shadcn/ui patterns with proper TypeScript types and a test file.

## Usage
`/create-component [name]` — e.g., `/create-component PricingCard`, `/create-component TenantStatusBadge`

## Steps

### 1. Determine Component Details
From the name, determine:
- Component file: `packages/frontend/src/components/{area}/{component-name}.tsx` (kebab-case file, PascalCase component)
- Whether it's a page component, a reusable UI component, or a feature component
- What shadcn/ui primitives it should compose (Card, Badge, Table, Dialog, etc.)

### 2. Check Existing Components
- Run `pnpm dlx shadcn@latest info --json` to see what shadcn components are installed
- Check if similar components already exist in the codebase
- Identify which shadcn/ui primitives need to be added first

### 3. Create Component
In `packages/frontend/src/components/{area}/{component-name}.tsx`:

```tsx
// Template structure — adapt to specific component
import { type FC } from 'react';
// Import from @shared/ for types
// Import shadcn/ui components

interface ComponentNameProps {
  // Typed props — derive from Zod schemas where applicable
}

export const ComponentName: FC<ComponentNameProps> = ({ ...props }) => {
  return (
    // Compose shadcn/ui primitives
    // Use semantic colors (bg-primary, text-muted-foreground)
    // Use gap-* not space-y-*
    // Use size-* when w and h are equal
  );
};
```

Every component MUST follow:
- [ ] Props interface with explicit types (derived from Zod where applicable)
- [ ] shadcn/ui primitives composed correctly (see shadcn skill rules)
- [ ] Semantic color tokens (no raw colors like bg-blue-500)
- [ ] gap-* for spacing (no space-y-* or space-x-*)
- [ ] Accessible (semantic HTML, ARIA labels, keyboard navigation)
- [ ] Responsive (works on desktop and tablet)
- [ ] cn() for conditional classes

### 4. Create Test File
In `packages/frontend/src/components/{area}/{component-name}.test.tsx`:
- Renders without crashing
- Displays expected content with given props
- Handles empty/missing data gracefully
- Interactive elements work (clicks, form submissions)

### 5. Report
Print what was created:
- Component file path
- Test file path
- What shadcn/ui components it uses
- Props interface
- Reminder to wire up data fetching and state management
