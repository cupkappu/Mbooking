# Subtree Balance Feature Design Document

**Date:** 2026-01-19
**Status:** Draft
**Author:** Sisyphus

---

## 1. Overview

### 1.1 Problem Statement

The account tree page currently displays only individual account balances. Users need to see the total balance of an account including all its descendants (subtree balance) to understand the true scope of each account.

### 1.2 Goals

- Display subtree balance (account balance + all descendants) for accounts with children
- Support multi-currency aggregation
- Allow users to select display currency globally
- Provide lazy-loading for subtree details on demand

### 1.3 Non-Goals

- Real-time balance updates (cached results acceptable)
- Complex filtering beyond currency selection
- Multi-tenant hierarchy (current design uses user_id as tenant_id)

---

## 2. Backend Design

### 2.1 Tenant Auto-Creation Flow

**Problem:** The `tenants` table is empty, causing `GET /api/v1/tenants/current` to return 404.

**Solution:** Modify `AuthService` to create a Tenant record on first user login.

```typescript
// backend/src/auth/auth.service.ts

async login(user: User) {
  // ... existing login logic

  // Ensure tenant exists
  await this.ensureTenantExists(user.id);
}

private async ensureTenantExists(userId: string): Promise<void> {
  const tenant = await this.tenantRepository.findOne({
    where: { user_id: userId },
  });

  if (!tenant) {
    await this.tenantRepository.save({
      user_id: userId,
      name: `Tenant ${userId}`,
      settings: {
        default_currency: 'USD',
        timezone: 'UTC',
      },
    });
  }
}
```

### 2.2 Extended Balance Query API

**Endpoint:** `POST /api/v1/query/balances`

**Request:**

```typescript
interface BalanceQuery {
  // Existing fields
  date_range?: { from: string; to: string };
  depth?: number;
  account_filter?: {
    types?: AccountType[];
    paths?: string[];
  };
  convert_to?: string;           // Display currency for converted amounts
  exchange_rate_date?: 'latest' | 'query_date' | 'specific_date';
  specific_date?: string;
  pagination?: { offset?: number; limit?: number };
  use_cache?: boolean;

  // NEW: Subtree balance support
  subtree_account_ids?: string[]; // Calculate subtree balance for specific accounts
  include_subtree?: boolean;      // Include subtree balance for all accounts at depth+1
}
```

**Response:**

```typescript
interface BalanceResponse {
  balances: AccountBalance[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
  meta: {
    cache_hit: boolean;
    calculated_at: string;
    display_currency?: string; // NEW: The currency used for converted values
  };
}

interface AccountBalance {
  account: Account;
  currencies: CurrencyBalance[];         // Account's own balance
  
  // NEW: Subtree balance fields
  subtree_currencies?: CurrencyBalance[]; // All descendants' balances + own
  converted_subtree_total?: number;        // Total in display currency
  converted_subtree_currency?: string;     // Display currency code
}
```

### 2.3 Subtree Balance Calculation Logic

```typescript
// backend/src/query/query.service.ts

async getBalances(tenantId: string, query: BalanceQuery): Promise<BalanceResponse> {
  // ... existing cache and account fetch logic

  const balances = await Promise.all(
    accounts.map(async (account) => {
      const currencyBalances = await this.calculateAccountBalance(
        account.id,
        query.date_range,
      );

      let result: AccountBalance = {
        account,
        currencies: currencyBalances,
      };

      // NEW: Calculate subtree balance if requested
      if (query.include_subtree || query.subtree_account_ids?.includes(account.id)) {
        const subtreeCurrencies = await this.calculateSubtreeBalance(
          account.id,
          query.date_range,
        );

        const convertedSubtree = query.convert_to
          ? await this.convertBalances(subtreeCurrencies, query.convert_to)
          : subtreeCurrencies;

        const totalConverted = convertedSubtree.reduce(
          (sum, b) => sum + b.amount,
          0,
        );

        result = {
          ...result,
          subtree_currencies: subtreeCurrencies,
          converted_subtree_total: Math.round(totalConverted * 10000) / 10000,
          converted_subtree_currency: query.convert_to,
        };
      }

      return result;
    }),
  );

  // ... existing merge, pagination, cache logic
}

private async calculateSubtreeBalance(
  accountId: string,
  dateRange?: { from: string; to: string },
): Promise<CurrencyBalance[]> {
  // Get all descendants using materialized path
  const account = await this.accountRepository.findOne({
    where: { id: accountId },
  });

  if (!account) return [];

  const descendants = await this.accountRepository
    .createQueryBuilder('account')
    .where('account.path LIKE :path', { path: `${account.path}%` })
    .getMany();

  const allAccountIds = [accountId, ...descendants.map((d) => d.id)];

  // Get balance for each account and aggregate by currency
  const allBalances: CurrencyBalance[] = [];
  for (const id of allAccountIds) {
    const accountBalances = await this.calculateAccountBalance(id, dateRange);
    allBalances.push(...accountBalances);
  }

  return this.mergeCurrencies(allBalances);
}

private mergeCurrencies(balances: CurrencyBalance[]): CurrencyBalance[] {
  const merged = new Map<string, number>();

  for (const balance of balances) {
    const current = merged.get(balance.currency) || 0;
    merged.set(balance.currency, current + balance.amount);
  }

  return Array.from(merged.entries()).map(([currency, amount]) => ({
    currency,
    amount: Math.round(amount * 10000) / 10000,
  }));
}
```

### 2.4 Tenant Settings Update Endpoint

**Endpoint:** `PUT /api/v1/tenants/settings`

```typescript
// backend/src/tenants/tenants.controller.ts

@Put('settings')
@ApiOperation({ summary: 'Update tenant settings' })
async updateSettings(@Request() req, @Body() settings: { default_currency?: string; timezone?: string }) {
  const tenant = await this.tenantsService.findByUserId(req.user.userId);
  const currentSettings = tenant.settings || {};
  
  return this.tenantsService.update(tenant.id, {
    settings: {
      ...currentSettings,
      ...settings,
    },
  });
}
```

---

## 3. Frontend Design

### 3.1 Global Currency Selector

**Location:** Account tree page header, near search/filter controls

```typescript
// frontend/app/(dashboard)/accounts/page.tsx

const [displayCurrency, setDisplayCurrency] = useState<string>(() => {
  // Try to get from localStorage first, fallback to tenant default
  const saved = localStorage.getItem('display_currency');
  return saved || tenantSettings?.default_currency || 'USD';
});

const handleCurrencyChange = (currency: string) => {
  setDisplayCurrency(currency);
  localStorage.setItem('display_currency', currency);
};

// Pass to balance query
const { data: balancesData } = useBalances({
  depth: 1,
  convert_to: displayCurrency,
  include_subtree: true,
});
```

### 3.2 Balance Cell Component

**Location:** `frontend/components/accounts/BalanceCell.tsx`

```typescript
interface BalanceCellProps {
  currencies: CurrencyBalance[];
  subtreeCurrencies?: CurrencyBalance[];
  convertedSubtreeTotal?: number;
  displayCurrency: string;
}

function BalanceCell({
  currencies,
  subtreeCurrencies,
  convertedSubtreeTotal,
  displayCurrency,
}: BalanceCellProps) {
  // Format: "1,000.00 CNY + 100.00 USD + 4,000.00 HKD"
  const balanceText = currencies
    .map((c) => `${formatNumber(c.amount)} ${c.currency}`)
    .join(' + ');

  // Format: "5,800.00 HKD"
  const convertedText = subtreeCurrencies && subtreeCurrencies.length > 0
    ? subtreeCurrencies
        .map((c) => `${formatNumber(c.amount)} ${c.currency}`)
        .join(' + ')
    : null;

  const totalText = convertedSubtreeTotal
    ? `${formatNumber(convertedSubtreeTotal)} ${displayCurrency}`
    : null;

  return (
    <div className="flex flex-col">
      {/* Main balance */}
      <span className="font-mono">
        {balanceText || '0.00'}
      </span>
      
      {/* Converted total for this account */}
      {currencies.length > 0 && currencies[0].currency !== displayCurrency && (
        <span className="text-xs text-muted-foreground font-mono">
          = {totalText}
        </span>
      )}

      {/* Subtree balance section */}
      {subtreeCurrencies && subtreeCurrencies.length > 0 && (
        <>
          <div className="h-px bg-border my-1" />
          <span className="text-sm text-foreground font-mono">
            {convertedText}
          </span>
          {convertedSubtreeTotal && (
            <span className="text-xs text-muted-foreground font-mono">
              = {totalText}
            </span>
          )}
        </>
      )}
    </div>
  );
}
```

### 3.3 Account Row Component Update

```typescript
// In the account tree render function
{filteredAccounts.map((account) => {
  const balance = balancesData?.balances.find(
    (b) => b.account.id === account.id
  );
  const hasChildren = account.parent_id === null && 
    filteredAccounts.some((a) => a.parent_id === account.id);

  return (
    <AccountRow
      key={account.id}
      account={account}
      balance={balance}
      showSubtreeBalance={hasChildren && !!balance?.subtree_currencies}
      displayCurrency={displayCurrency}
      depth={account.depth}
      isExpanded={expandedAccounts.has(account.id)}
      onToggleExpand={() => toggleExpand(account.id)}
    />
  );
})}
```

### 3.4 Settings Page Update

**Location:** `frontend/app/(dashboard)/settings/page.tsx`

```typescript
function GeneralSettings() {
  const { data: tenantData } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => apiClient.get('/tenants/current'),
  });

  const [form, setForm] = useState({
    default_currency: tenantData?.settings?.default_currency || 'USD',
    timezone: tenantData?.settings?.timezone || 'UTC',
  });

  const handleSave = async () => {
    await apiClient.put('/tenants/settings', form);
    // Show success toast
  };

  return (
    <Card>
      {/* ... */}
      <Select
        value={form.default_currency}
        onValueChange={(value) => setForm({ ...form, default_currency: value })}
      >
        {/* ... currency options ... */}
      </Select>
      <Button onClick={handleSave}>Save Settings</Button>
    </Card>
  );
}
```

### 3.5 UI Mockup

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Accounts                                                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  [🔍 Search...]  [USD ▼]  [Filter by parent ▼]     [+ New Account]                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Account                    │ Type      │ Currency │ Balance      │ Subtree Balance │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ▶ Assets                   │ assets    │ USD      │              │                 │
│    ▶ Bank Account           │ assets    │ USD      │ 16,000.00 USD│                 │
│      = 12,448,000 HKD       │           │          │              │                 │
│    ▶ Cash                   │ assets    │ CNY      │ 5,000.00 CNY │                 │
│      = 640.00 USD           │           │          │              │                 │
│  ▶ Liabilities              │ liabili.. │ USD      │              │                 │
│    ▶ Loans                  │ liabili.. │ USD      │ 10,000.00 USD│                 │
│      = 7,780,000 HKD        │           │          │              │                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow

### 4.1 Initial Page Load

```
1. User navigates to /accounts
2. Frontend checks localStorage for display_currency
3. Frontend fetches tenant settings (GET /tenants/current)
4. Frontend fetches accounts (GET /accounts/tree)
5. Frontend fetches balances:
   - POST /query/balances
   - { depth: 1, include_subtree: true, convert_to: display_currency }
6. Backend:
   a. Fetch all accounts for tenant
   b. For each account, calculate account balance
   c. For each account, calculate subtree balance (self + descendants)
   d. Convert subtree balance to display currency
   e. Return combined result
7. Frontend renders account tree with balances
```

### 4.2 Currency Change

```
1. User selects new display currency
2. Frontend updates localStorage
3. Frontend refetches balances with new convert_to
4. All balance displays update
```

### 4.3 Expand Account

```
1. User clicks expand on account with children
2. Frontend adds account ID to expanded set
3. Frontend filters accounts to show children
4. (Optional) Frontend fetches subtree balance for this account
```

---

## 5. Error Handling

### 5.1 Backend

| Error | Handling |
|-------|----------|
| Tenant not found | Auto-create tenant on first access |
| Invalid currency | Return 400 with clear error message |
| Rate fetch failure | Log error, skip conversion, return original currencies |
| Cache miss | Calculate fresh, store in cache (5 min TTL) |

### 5.2 Frontend

| Error | Handling |
|-------|----------|
| API error | Show toast notification, retry button |
| Currency conversion failed | Show original currencies only |
| Loading state | Show skeleton/spinner |

---

## 6. Testing Considerations

### 6.1 Backend Tests

```typescript
// calculateSubtreeBalance
it('should calculate subtree balance correctly', async () => {
  // Setup: parent account with two children, each with different currencies
  // Execute
  const result = await service.calculateSubtreeBalance(parentAccountId);
  // Assert
  expect(result).toEqual([
    { currency: 'USD', amount: 1500 },
    { currency: 'CNY', amount: 2000 },
  ]);
});

it('should handle account with no children', async () => {
  // Execute
  const result = await service.calculateSubtreeBalance(leafAccountId);
  // Assert: should equal the account's own balance
  expect(result).toEqual(leafAccountBalance);
});
```

### 6.2 Frontend Tests

```typescript
// BalanceCell
it('formats multi-currency balance correctly', () => {
  render(<BalanceCell
    currencies={[
      { currency: 'CNY', amount: 1000 },
      { currency: 'USD', amount: 100 },
    ]}
    displayCurrency="HKD"
  />);
  expect(screen.getByText('1,000.00 CNY + 100.00 USD')).toBeInTheDocument();
});
```

---

## 7. Implementation Tasks

### Phase 1: Foundation
- [ ] Auto-create tenant on first login
- [ ] Implement tenant settings update endpoint
- [ ] Update frontend settings page to save Default Currency
- [ ] Verify convert_to parameter works end-to-end

### Phase 2: Backend Subtree Logic
- [ ] Implement calculateSubtreeBalance method
- [ ] Extend getBalances to support include_subtree
- [ ] Update API response types
- [ ] Add tests for subtree calculation

### Phase 3: Frontend Display
- [ ] Add global currency selector
- [ ] Create BalanceCell component
- [ ] Update account tree to show subtree balances
- [ ] Add lazy-loading for subtree details (optional)

---

## 8. Open Questions

1. **Subtree balance display threshold** - Should we only show subtree balance when there are actual descendants (not just potential)?
2. **Performance** - For accounts with many descendants, subtree calculation could be expensive. Should we add a limit?
3. **Cache invalidation** - When a new journal entry is added, how do we invalidate subtree balance cache?

---

## 9. References

- Existing `mergeByDepth` implementation: `backend/src/query/query.service.ts:288-328`
- Existing `convertBalances` implementation: `backend/src/query/query.service.ts:260-286`
- Account entity: `backend/src/accounts/account.entity.ts`
- Frontend account types: `frontend/types/index.ts`
