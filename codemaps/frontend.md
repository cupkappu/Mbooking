# Frontend Codemap

Generated: 2026-01-27T00:00:00.000Z

## Next.js App Router Structure

```
frontend/app/
├── (auth)/                    # Auth route group (no sidebar)
│   ├── login/
│   │   ├── page.tsx
│   │   └── page.spec.tsx
│   ├── register/
│   │   └── page.tsx
│   └── callback/              # OAuth callback
│
├── (dashboard)/               # Main app route group
│   ├── layout.tsx             # Dashboard layout (sidebar + header)
│   ├── dashboard/
│   │   └── page.tsx
│   ├── accounts/
│   │   ├── page.tsx
│   │   ├── page.spec.tsx
│   │   ├── [id]/
│   │   └── new/
│   ├── journal/
│   │   ├── page.tsx
│   │   ├── [id]/
│   │   └── new/
│   ├── budgets/
│   │   ├── page.tsx
│   │   └── [id]/
│   ├── reports/
│   │   ├── page.tsx
│   │   ├── balance-sheet/
│   │   ├── cash-flow/
│   │   ├── income-statement/
│   │   └── income-statement/comparison/
│   └── settings/
│       └── page.tsx
│
├── (setup)/                   # Setup route group
│   └── setup/
│       ├── page.tsx
│       ├── page.spec.tsx
│       └── setup-form.tsx
│
├── admin/                     # Admin route group
│   ├── layout.tsx
│   ├── page.tsx
│   ├── currencies/
│   ├── providers/
│   ├── users/
│   ├── logs/
│   ├── scheduler/
│   ├── health/
│   ├── system/
│   ├── plugins/
│   └── export/
│
├── api/
│   ├── auth/[...nextauth]/    # NextAuth.js API
│   │   └── route.ts
│   └── v1/[...path]/          # Backend proxy
│       └── route.ts
│
├── layout.tsx                 # Root layout
├── page.tsx                   # Landing page
└── globals.css
```

## Route Groups Summary

| Route Group | Layout | Purpose |
|-------------|--------|---------|
| `(auth)` | Minimal | Login, Register, OAuth callbacks |
| `(dashboard)` | Sidebar + Header | Main application |
| `(setup)` | Minimal | Initial system setup |
| `admin` | Admin layout | Administration panel |

## React Query Hooks Location

```
frontend/hooks/
├── use-api.ts               # Accounts, journal, balances, dashboard
├── use-admin.ts             # Admin panel operations
├── use-setup.ts             # System setup
├── use-currencies.ts        # Currency operations
├── use-budgets.ts           # Budget CRUD
├── use-budget-progress.ts   # Budget progress tracking
├── use-budget-templates.ts  # Budget templates
├── use-budget-variance.ts   # Budget variance reports
├── use-budget-alerts.ts     # Budget alerts
├── use-multi-currency-summary.ts
├── use-export-accounts.ts   # Account export
├── use-export-bills.ts      # Bill export
├── useAutoBalance.ts        # Auto-balance journal entries
└── use-toast.ts             # Toast notifications
```

### Key Hooks from `use-api.ts`

| Hook | Purpose | Query Key |
|------|---------|-----------|
| `useAccounts()` | Get account tree | `['accounts']` |
| `useAccount(id)` | Get single account | `['accounts', id]` |
| `useCreateAccount()` | Create account | - |
| `useUpdateAccount()` | Update account | - |
| `useDeleteAccount()` | Delete account | - |
| `useJournalEntries()` | List journal entries | `['journal-entries']` |
| `useCreateJournalEntry()` | Create entry | - |
| `useBalances(query)` | Get balances | `['balances', query]` |
| `useDashboardSummary()` | Dashboard data | `['dashboard-summary']` |
| `useDefaultCurrency()` | Tenant default currency | `['default-currency']` |

## Component Organization

```
frontend/components/
├── ui/                      # Base UI components
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── sheet.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── avatar.tsx
│   ├── dropdown-menu.tsx
│   ├── label.tsx
│   └── switch.tsx
│
├── layout/
│   └── user-menu.tsx
│
├── journal/
│   ├── journal-entry-card.tsx
│   └── AutoBalanceButton.tsx
│
├── accounts/
│   └── BalanceDisplay.tsx
│
├── budgets/
│   ├── budget-form/
│   ├── budget-card/
│   ├── progress-bar/
│   ├── variance-report/
│   ├── multi-currency-summary/
│   ├── template-browser/
│   └── alert-center/
│
├── export/
│   ├── export-button.tsx
│   └── export-filter-panel.tsx
│
├── home/
│   ├── header.tsx
│   ├── footer.tsx
│   ├── hero-section.tsx
│   └── features-section.tsx
│
└── session-sync.tsx         # Session token sync
```

## Library Utilities

```
frontend/lib/
├── api.ts                   # ApiClient for backend requests
├── auth-options.ts          # NextAuth configuration
├── currencies.ts            # Currency utilities
├── currency-formatter.ts    # Currency formatting
├── providers.ts             # Provider utilities
├── utils.ts                 # General utilities (cn helper)
├── tenants.ts               # Tenant utilities
├── auto-balance.ts          # Auto-balance logic
└── utils.test.ts
```

## API Proxy Configuration

### Next.js Route Handler: `/api/v1/[...path]/route.ts`

Proxies all requests from `/api/v1/*` to backend at `NEXT_PUBLIC_API_URL` (default: `http://localhost:3001`).

```typescript
// Frontend request
GET /api/v1/accounts/tree

// Proxied to backend
GET http://localhost:3001/api/v1/accounts/tree
```

### ApiClient Pattern (`lib/api.ts`)

```typescript
class ApiClient {
  async get<T>(endpoint: string): Promise<T>
  async post<T>(endpoint: string, body: object): Promise<T>
  async put<T>(endpoint: string, body: object): Promise<T>
  async delete<T>(endpoint: string): Promise<T>
}

export const apiClient = new ApiClient();
```

**Authentication Flow:**
1. Check `localStorage` for `accessToken` (set by `SessionSync`)
2. Fallback: Fetch from `/api/auth/session`
3. Add `Authorization: Bearer <token>` header

## Providers

```
frontend/providers/
├── app-providers.tsx        # Root providers (Session + Query)
├── session-provider.tsx     # NextAuth session wrapper
└── query-provider.tsx       # React Query client
```

## Providers Configuration

```typescript
// app-providers.tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <QueryProvider>
        {children}
      </QueryProvider>
    </NextAuthSessionProvider>
  );
}
```

## Types

```
frontend/types/
├── index.ts                 # Main type exports
├── currency.ts              # Currency types
├── provider.ts              # Provider types
├── tenant.ts                # Tenant types
├── auto-balance.ts          # Auto-balance types
├── export.ts                # Export types
└── next-auth.d.ts           # NextAuth type extensions
```

## Middleware

### `frontend/middleware.ts`

- Protects routes based on authentication
- Redirects unauthenticated users to `/login`
- Handles session validation

## Dashboard Layout Structure

```
┌─────────────────────────────────────────────────┐
│  ┌──┐  Dashboard      [User Menu]              │
│  ├──┤                                          │
│  ├──┤  Navigation:                            │
│  ├──┤  • Dashboard                             │
│  ├──┤  • Budgets                               │
│  ├──┤  • Accounts                              │
│  ├──┤  • Journal                               │
│  ├──┤  • Reports                               │
│  ├──┤  • Settings                              │
│  ├──┤                                          │
│  ├──┤  [Admin Panel] (if admin role)           │
│  └──┘                                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  Main Content Area                             │
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

## API Integration Pattern

```typescript
// Typical hook pattern
export function useData() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ['key'],
    queryFn: () => apiClient.get('/endpoint'),
    enabled: status === 'authenticated' && !!session?.accessToken,
  });
}

// Mutation with cache invalidation
export function useCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => apiClient.post('/endpoint', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key'] });
    },
  });
}
```
