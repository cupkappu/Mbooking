# Frontend Module Guide (Next.js)

**Location:** `frontend/`
**Port:** 3000
**Generated:** 2026-01-24

---

## Page Structure

```
frontend/app/
├── (auth)/                   # Auth route group
│   ├── login/
│   │   └── page.tsx          # Login page
│   └── layout.tsx            # Auth layout
│
├── (dashboard)/              # Main app route group
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard home
│   ├── accounts/
│   │   ├── page.tsx          # Account list
│   │   ├── new/
│   │   │   └── page.tsx      # Create account
│   │   └── [id]/
│   │       └── page.tsx      # Account detail
│   ├── journal/
│   │   ├── page.tsx          # Journal list
│   │   ├── new/
│   │   │   └── page.tsx      # Create entry
│   │   └── [id]/
│   │       └── page.tsx      # Entry detail
│   ├── reports/
│   │   ├── page.tsx          # Reports list
│   │   ├── balance-sheet/
│   │   │   └── page.tsx      # Balance sheet
│   │   └── income-statement/
│   │       └── page.tsx      # Income statement
│   ├── settings/
│   │   ├── page.tsx          # Settings home
│   │   ├── currencies/
│   │   │   └── page.tsx      # Currency management
│   │   └── providers/
│   │       └── page.tsx      # Provider management
│   └── layout.tsx            # Dashboard layout
│
├── api/
│   └── [...nextauth]/        # NextAuth.js handler
└── page.tsx                  # Root redirect
```

---

## Component Structure

```
frontend/components/
├── ui/                       # shadcn/ui base components
│   ├── button/
│   ├── card/
│   ├── dialog/
│   ├── table/
│   ├── form/
│   ├── input/
│   ├── select/
│   ├── tabs/
│   └── ...
│
├── layout/                   # Layout components
│   ├── sidebar/
│   ├── header/
│   └── footer/
│
├── accounts/                 # Account components
│   ├── account-tree/
│   ├── account-card/
│   ├── account-form/
│   └── balance-display/
│
├── journal/                  # Journal components
│   ├── journal-entry-list/
│   ├── journal-entry-form/
│   ├── line-editor/
│   ├── tag-input/
│   └── amount-input/
│
├── reports/                  # Report components
│   ├── balance-sheet/
│   ├── income-statement/
│   ├── chart/
│   └── export-button/
│
├── rates/                    # Rate components
│   ├── rate-display/
│   ├── rate-chart/
│   └── currency-selector/
│
├── budgets/                  # Budget components
│   ├── budget-card/
│   ├── progress-bar/
│   └── budget-form/
│
├── export/                   # Export components
│   └── export-button/
│
├── home/                     # Home page components
│   └── stats-cards/
│
└── common/                   # Shared components
    ├── date-picker/
    ├── currency-input/
    └── loading-spinner/
```

---

## Hook Structure

```
frontend/hooks/
├── use-accounts.ts           # Account data
├── use-journal-entries.ts    # Journal data
├── use-balances.ts           # Balance queries
├── use-rates.ts              # Exchange rates
├── use-budgets.ts            # Budget data
├── use-reports.ts            # Report generation
├── use-api.ts                # Generic API calls
├── use-admin.ts              # Admin operations
├── use-currencies.ts         # Currency management
├── use-setup.ts              # Setup flow
├── use-export-accounts.ts    # Account export
└── use-export-bills.ts       # Bill export
```

---

## Key Libraries

| Library | Purpose |
|---------|---------|
| **Next.js 14** | App Router, SSR |
| **React** | UI library |
| **TanStack Query** | Server state, caching |
| **NextAuth.js** | Authentication |
| **Tailwind CSS** | Utility styling |
| **shadcn/ui** | Component library |
| **React Hook Form** | Form management |
| **Zod** | Schema validation |
| **date-fns** | Date manipulation |
| **clsx** | Class merging |

---

## State Management

### TanStack Query (Recommended)

```typescript
// hooks/use-accounts.ts
export function useAccounts(depth?: number) {
  return useQuery({
    queryKey: ['accounts', { depth }],
    queryFn: () => accountsApi.list({ depth }),
    staleTime: 5 * 60 * 1000,
  });
}
```

### Local State

```typescript
// Use useState, useReducer for local UI state
// Use useContext sparingly (auth context only)
```

---

## API Client

**Location:** `frontend/lib/api.ts`

```typescript
class ApiClient {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL;
  private headers = { 'Content-Type': 'application/json' };

  setAuthToken(token: string) {
    this.headers['Authorization'] = `Bearer ${token}`;
  }

  async get<T>(endpoint: string) { /* ... */ }
  async post<T>(endpoint: string, body: object) { /* ... */ }
  async put<T>(endpoint: string, body: object) { /* ... */ }
  async delete<T>(endpoint: string) { /* ... */ }
}

export const apiClient = new ApiClient();
```

---

## Development Conventions

### Component Pattern

```tsx
// components/accounts/account-card.tsx
interface AccountCardProps {
  account: Account;
  onEdit?: (account: Account) => void;
}

export function AccountCard({ account, onEdit }: AccountCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{account.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <BalanceDisplay amount={account.balance} currency={account.currency} />
      </CardContent>
    </Card>
  );
}
```

### Form Handling

```tsx
// Use React Hook Form + Zod validation
const form = useForm<CreateAccountSchema>({
  resolver: zodResolver(CreateAccountSchema),
  defaultValues: { type: 'assets' },
});
```

### Styling

- Use Tailwind CSS utility classes
- Follow shadcn/ui patterns
- Maintain design consistency

---

## Commands

```bash
# Development
cd frontend
npm run dev               # Development server
npm run build             # Production build
npm run start             # Production server
npm run lint              # Linting
npm run type-check        # TypeScript check

# Testing
npm run test              # Unit tests
npm run test:e2e          # E2E tests (Playwright)
npm run test:coverage     # Coverage report
```

---

## Anti-Patterns

- **NEVER** embed secrets → use env vars
- **NEVER** skip loading states → show loading indicators
- **NEVER** skip error handling → show error messages
- **NEVER** use `any` type → use proper types
- **NEVER** skip form validation → use Zod schemas

---

## CI/CD Patterns

1. **Next.js Standalone Output**: `output: 'standalone'` in next.config.mjs for minimal Docker images
2. **CI-Aware Playwright**:
   - `forbidOnly: !!process.env.CI` - Fails build if test.only left in code
   - `retries: process.env.CI ? 2 : 0` - Retries only in CI
   - `workers: process.env.CI ? 1 : undefined` - Sequential in CI
   - `reuseExistingServer: !process.env.CI` - Fresh server in CI
3. **Multi-browser Testing**: 7 projects (Chromium, Firefox, WebKit, mobile)

---

## Testing Conventions

### Frontend Test Structure
```
frontend/
├── jest.config.ts              # Jest config with path aliases
├── jest.setup.js               # Global mocks (NextAuth, next/navigation, React Query)
├── playwright.config.ts        # E2E config (port 3000, auto webServer)
├── app/**/*.spec.tsx          # Component tests
├── hooks/*.spec.tsx           # Hook tests
├── lib/*.spec.ts              # Utility tests
└── tests/                     # E2E tests
    ├── utils/
    │   ├── auth.ts            # Login helpers
    │   ├── test-data.ts       # Constants
    │   └── page-objects.ts
    └── *.spec.ts              # E2E specs
```

### Jest Config (frontend/jest.config.ts)
- `collectCoverage: true`, coverageProvider: 'v8'
- Path aliases: `@/`, `@/components/`, `@/lib/`, `@/hooks/`, `@/types/`
- Environment: jsdom
- Global mocks in `jest.setup.js`

### Playwright Multi-Browser
```typescript
projects: [
  { name: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'firefox', use: devices['Desktop Firefox'] },
  { name: 'webkit', use: devices['Desktop Safari'] },
  { name: 'Mobile Chrome', use: devices['Pixel 5'] },
  { name: 'Mobile Safari', use: devices['iPhone 12'] },
  // ... 2 more mobile projects
]
```

### Test Scripts
```bash
npm run test              # Jest unit tests
npm run test:watch        # Jest watch mode
npm run test:coverage     # Coverage report
npm run test:e2e          # Playwright E2E (port 3000)
npm run test:e2e:ui       # Playwright UI mode
```

---

## Routing Patterns

### Dynamic Routes

```
/accounts/[id]        → page.tsx in [id] folder
/journal/[id]/edit    → page.tsx in [id]/edit folder
```

### Route Groups

```
(app)/layout.tsx      → Applies to entire app
(auth)/layout.tsx     → Applies to auth routes only
(dashboard)/layout.tsx → Applies to dashboard routes
```

### Parallel Routes (Future)

```
@modal/                → Modal overlay routes
```

---

## Backend Communication

| Purpose | Library |
|---------|---------|
| HTTP requests | `fetch` or `axios` |
| API client | `lib/api.ts` |
| Auth token | NextAuth.js session |
| Real-time | Not implemented (future) |

---

## Cross-References

- [Backend AGENTS.md](../backend/AGENTS.md)
- [Requirements - API](../docs/requirements/REQUIREMENTS_API.md)
- [Requirements - Core Features](../docs/requirements/REQUIREMENTS_CORE.md)
