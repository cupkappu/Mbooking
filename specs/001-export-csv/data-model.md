# Data Model: CSV Export Feature

**Feature**: Export bills and accounts to CSV  
**Generated**: 2026-01-23

## Entities

### Export Audit Log

Tracks export requests for audit purposes and debugging.

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| id | UUID | Yes | Primary Key | |
| tenant_id | string | Yes | Foreign Key | Multi-tenant isolation |
| user_id | string | Yes | Foreign Key | Who initiated export |
| export_type | enum | Yes | 'bills' \| 'accounts' | What was exported |
| filters_applied | JSON | No | Nullable | Date range, account types |
| record_count | number | Yes | Min 0 | Number of records exported |
| status | enum | Yes | 'success' \| 'failed' | Export result |
| error_message | string | No | Nullable | Error details if failed |
| created_at | timestamp | Yes | Default now | When export was requested |
| file_size_bytes | number | No | Nullable | Size of generated CSV |

**Relationships**:
- Many-to-one with Tenant (tenant_id)
- Many-to-one with User (user_id)

**Indexes**:
- `idx_export_audit_tenant_created` (tenant_id, created_at)
- `idx_export_audit_user` (user_id)

---

## Data Transfer Objects (DTOs)

### Export Bills DTO

Input for bill export requests.

```typescript
interface ExportBillsDto {
  // Date range filter (optional)
  date_from?: string;  // ISO 8601 date format
  date_to?: string;    // ISO 8601 date format
  
  // Preset date ranges (mutually exclusive with date_from/date_to)
  date_preset?: 'last_30_days' | 'last_90_days' | 'this_year' | 'all_time';
  
  // Account type filter (optional)
  account_types?: AccountType[];
  
  // Format options
  include_header?: boolean;  // Default: true
  delimiter?: ',' | ';' | '\t';  // Default: ','
}
```

### Export Accounts DTO

Input for account export requests.

```typescript
interface ExportAccountsDto {
  // Account type filter (optional)
  account_types?: AccountType[];
  
  // Include inactive accounts (optional)
  include_inactive?: boolean;  // Default: false
  
  // Format options
  include_header?: boolean;  // Default: true
  delimiter?: ',' | ';' | '\t';  // Default: ','
}
```

### Export Response DTO

API response for export initiation.

```typescript
interface ExportResponseDto {
  success: boolean;
  message: string;
  export_id?: UUID;  // For polling status
  download_url?: string;  // For immediate download
  record_count?: number;
  file_size_bytes?: number;
  error_code?: string;
  error_message?: string;
}
```

---

## CSV Schema Definitions

### Bills CSV Schema

| Column | Field Source | Format | Example |
|--------|--------------|--------|---------|
| Date | journal_entry.date | ISO 8601 | 2024-01-15 |
| Description | journal_entry.description | String | "Office supplies purchase" |
| Debit Account | line (where amount > 0).account.name | String | "Expenses:Office" |
| Credit Account | line (where amount < 0).account.name | String | "Assets:Cash" |
| Amount | line.amount | Decimal | 150.50 |
| Currency | line.currency | ISO 4217 | "USD" |
| Reference ID | journal_entry.reference_id | String | Optional |

### Accounts CSV Schema

| Column | Field Source | Format | Example |
|--------|--------------|--------|---------|
| Account Name | account.name | String | "Assets:Cash:USD" |
| Account Type | account.type | Enum | "assets" |
| Parent Account | account.parent.name | String | "Assets:Cash" |
| Currency | account.currency | ISO 4217 | "USD" |
| Balance | computed | Decimal | 5000.00 |
| Is Active | account.is_active | Boolean | true |
| Depth | account.depth | Integer | 2 |

---

## Validation Rules

1. **Date Range Validation**:
   - `date_from` must be before or equal to `date_to`
   - Date range cannot exceed 1 year (prevent accidentally large exports)
   - Invalid dates return 400 Bad Request

2. **Account Type Validation**:
   - Must be valid AccountType enum values
   - Empty array means no filter (export all)

3. **CSV Format Validation**:
   - Delimiter must be single character
   - UTF-8 BOM added for Excel compatibility

---

## State Transitions

### Export Request Lifecycle

```
PENDING -> PROCESSING -> SUCCESS
                |
                +-> FAILED
```

| State | Trigger | Next State |
|-------|---------|------------|
| PENDING | Export requested | PROCESSING |
| PROCESSING | Export in progress | SUCCESS or FAILED |
| SUCCESS | All records exported | Terminal |
| FAILED | Error during export | Terminal |

---

## Key Entities Reference

### JournalEntry (Existing)

Referenced for bill exports. Key fields used:
- `id` (UUID)
- `tenant_id` (string)
- `date` (timestamp)
- `description` (string)
- `reference_id` (string, nullable)
- `lines` (relation to JournalLine)

### JournalLine (Existing)

Details of each transaction line. Key fields used:
- `account_id` (UUID)
- `amount` (decimal)
- `currency` (string)

### Account (Existing)

Account hierarchy. Key fields used:
- `id` (UUID)
- `tenant_id` (string)
- `name` (string)
- `type` (AccountType enum)
- `currency` (string)
- `parent` (self-referencing relation)
- `path` (materialized path string)
- `depth` (integer)
- `is_active` (boolean)
