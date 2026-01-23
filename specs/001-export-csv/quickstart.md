# Quickstart: CSV Export Feature

**Feature**: Export bills and accounts to CSV  
**Branch**: `001-export-csv`  
**Date**: 2026-01-23

## Overview

This feature adds CSV export capability for:
- **Bills (Journal Entries)**: Export financial transactions with filters
- **Accounts**: Export account hierarchy with type filtering

## Technical Approach

### Architecture
- **Backend**: NestJS module with streaming CSV response
- **Frontend**: React components with React Query hooks
- **Format**: RFC 4180 compliant CSV with UTF-8 BOM for Excel

### Key Design Decisions
1. **Server-side streaming**: Avoids browser memory issues for large datasets
2. **Cursor-based pagination**: O(1) query performance for large exports
3. **UTF-8 BOM**: Ensures Excel compatibility
4. **RFC 4180 escaping**: Handles special characters in data

---

## Development Setup

### Prerequisites
```bash
# Ensure backend is running
cd backend && npm run start:dev

# Ensure frontend is running
cd frontend && npm run dev
```

### Verify Installation
```bash
# Test API endpoint
curl -X POST http://localhost:3001/api/v1/export/bills \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: <your-tenant-id>" \
  -d '{"date_preset": "last_30_days"}' \
  --output test-bills.csv

# Check output
head -5 test-bills.csv
```

---

## File Structure

```
backend/src/export/
├── export.module.ts        # NestJS module
├── export.service.ts       # CSV generation logic
├── export.controller.ts    # REST endpoints
├── dto/
│   ├── export-bills.dto.ts
│   ├── export-accounts.dto.ts
│   └── export-filters.dto.ts
├── entities/
│   └── export-audit.entity.ts
├── streams/
│   ├── csv-transform.stream.ts
│   └── csv-formatter.util.ts
└── export.service.spec.ts

frontend/src/components/export/
├── export-button.tsx       # Export button component
├── export-filter-panel.tsx # Optional filter UI
└── export-progress.tsx     # Progress indicator

frontend/src/hooks/
├── use-export-bills.ts     # React Query hook
└── use-export-accounts.ts  # React Query hook

e2e/export/
├── export-bills.spec.ts
└── export-accounts.spec.ts
```

---

## API Usage

### Export Bills

```bash
# Basic export (all bills)
curl -X POST http://localhost:3001/api/v1/export/bills \
  -H "X-Tenant-ID: <tenant-id>" \
  --output bills.csv

# With date filter
curl -X POST http://localhost:3001/api/v1/export/bills \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: <tenant-id>" \
  -d '{"date_preset": "last_30_days"}' \
  --output bills-recent.csv

# With account type filter
curl -X POST http://localhost:3001/api/v1/export/bills \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: <tenant-id>" \
  -d '{"account_types": ["assets", "expense"]}' \
  --output bills-filtered.csv
```

### Export Accounts

```bash
# Basic export (all active accounts)
curl -X POST http://localhost:3001/api/v1/export/accounts \
  -H "X-Tenant-ID: <tenant-id>" \
  --output accounts.csv

# With type filter
curl -X POST http://localhost:3001/api/v1/export/accounts \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: <tenant-id>" \
  -d '{"account_types": ["assets", "liabilities"]}' \
  --output accounts-filtered.csv
```

---

## Testing

### Unit Tests
```bash
# Backend unit tests
cd backend && npm run test -- --testPathPattern=export

# Frontend component tests
cd frontend && npm run test -- --testPathPattern=export
```

### E2E Tests
```bash
# Run export E2E tests
npm run test:e2e -- --project=export
```

### Manual Testing Checklist
- [ ] Export bills from bills page
- [ ] Export accounts from accounts page
- [ ] Test date range filters
- [ ] Test account type filters
- [ ] Verify UTF-8 encoding in Excel
- [ ] Test with large dataset (>1000 records)
- [ ] Verify tenant isolation (different tenants see only their data)

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Export 10,000 bills | < 10 seconds | Streaming response |
| Export 100 accounts | < 2 seconds | Small dataset |
| Memory usage | < 50 MB | Streaming, not buffered |
| Success rate | > 95% | Production target |

---

## Common Issues

### Issue: Excel shows garbled characters
**Cause**: Missing UTF-8 BOM  
**Fix**: Ensure server sends BOM bytes (EF BB BF)

### Issue: Export times out
**Cause**: Large dataset with offset pagination  
**Fix**: Use cursor-based pagination with streaming

### Issue: CSV parsing fails in spreadsheet
**Cause**: Unescaped commas or quotes in data  
**Fix**: RFC 4180 compliant escaping

---

## Next Steps

1. **Phase 2**: Run `/speckit.tasks` to generate implementation tasks
2. **Implementation**: Follow tasks.md for backend → frontend → E2E
3. **Review**: Ensure constitution compliance before PR
4. **Deploy**: Merge to `develop` after review

---

## References

- [Spec](./spec.md)
- [Research](./research.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/export-api.yaml)
- [Frontend Contracts](./contracts/frontend-contracts.md)
