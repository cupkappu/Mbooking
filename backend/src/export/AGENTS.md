# Export Module Guide

**Location:** `backend/src/export/`

---

## OVERVIEW

Memory-efficient CSV export of journal entries (bills) and accounts using Node.js async generators and transform streams for O(1) memory usage regardless of dataset size.

---

## STRUCTURE

```
export/
├── export.module.ts           # NestJS module, imports JournalEntry, JournalLine, Account
├── export.controller.ts       # REST: POST /export/bills, POST /export/accounts
├── export.service.ts          # Streaming logic, cursor pagination, audit logging
├── entities/
│   └── export-audit.entity.ts # ExportAuditLog entity, ExportType/ExportStatus enums
├── dto/
│   ├── export-bills.dto.ts    # Date presets, account type filters, delimiters
│   ├── export-accounts.dto.ts # Account type filters, include_inactive flag
│   └── export-filters.dto.ts  # ExportFilters interface, parseDatePreset()
└── streams/
    ├── csv-transform.stream.ts # Transform functions, BOM handling, pipeline builders
    └── csv-formatter.util.ts   # RFC 4180 CSV escaping, CsvFormatterUtil class
```

---

## EXPORT TYPES

| Type | Endpoint | Filters |
|------|----------|---------|
| **Bills** | `POST /export/bills` | date_preset (last_30_days, last_90_days, this_year, all_time), date_from/to, account_types, delimiter |
| **Accounts** | `POST /export/accounts` | account_types, include_inactive, delimiter |

---

## STREAMING

**Bills Export Pipeline:**
1. Cursor-based pagination (1000 records/batch) via `streamBillsData()` async generator
2. `Readable.from()` wraps generator into Node.js stream
3. UTF-8 BOM prepended for Excel compatibility
4. Header row + data rows streamed directly to response
5. Stream destroyed on response `finish` event

**Accounts Export:**
- Query all accounts (smaller dataset, no pagination needed)
- Same CSV formatting + BOM pattern

**Memory Characteristic:** O(1) - only one batch in memory at a time.

---

## PATTERNS

**Stream Transformation:**
```typescript
// Async generator → Readable stream → Transform → Response
Readable.from(asyncGenerator()) → pipe → Response
```

**Audit Logging:**
- Every export creates `ExportAuditLog` record
- Tracks: tenant_id, user_id, export_type, filters_applied, record_count, status
- Failed exports log error_message

**CSV Formatting:**
- RFC 4180 compliant (escapes commas, quotes, newlines)
- UTF-8 BOM (0xEF, 0xBB, 0xBF) for Excel
- Configurable delimiters: comma, semicolon, tab

**Tenant Isolation:**
- All queries filtered by `TenantContext.requireTenantId()`
- RLS-aware via TypeORM queries

---

## CROSS-REFERENCES

**Related Modules:**
- [Journal Module](../journal/) - JournalEntry, JournalLine entities
- [Accounts Module](../accounts/) - Account entity
- [Tenants Module](../tenants/) - TenantContext

**Key Dependencies:**
- `TypeOrmModule` for JournalEntry, JournalLine, Account, ExportAuditLog
- Node.js `stream` module for streaming
- `class-validator` for DTO validation

**See Also:**
- [Requirements - Core Features](../../docs/requirements/REQUIREMENTS_CORE.md)
- [Requirements - API](../../docs/requirements/REQUIREMENTS_API.md)
