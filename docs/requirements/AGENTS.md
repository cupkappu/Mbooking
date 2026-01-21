# Requirements Documentation Guide

**Location:** `docs/requirements/`
**Purpose:** Decomposed product requirements for all features

---

## File Inventory

| File | Scope | Primary Domain |
|------|-------|----------------|
| `REQUIREMENTS_CORE.md` | Account types, journal entries | Double-entry bookkeeping |
| `REQUIREMENTS_MULTI_CURRENCY.md` | Currency handling, rates | Multi-currency engine |
| `REQUIREMENTS_QUERY_ENGINE.md` | Balance queries, depth merging | Query system |
| `REQUIREMENTS_REPORTS.md` | Balance sheet, income statement | Financial reports |
| `REQUIREMENTS_BUDGETS.md` | Periodic budgets, alerts | Budget management |
| `REQUIREMENTS_PLUGIN_SYSTEM.md` | JS plugins, REST APIs | Rate provider extensibility |
| `REQUIREMENTS_ADMIN.md` | User management, system config | Admin panel |
| `REQUIREMENTS_API.md` | REST endpoints, auth | API specifications |
| `REQUIREMENTS_DATABASE.md` | Entities, RLS, migrations | Data model |
| `REQUIREMENTS_LANDING_PAGE.md` | Landing page features | Marketing site |

---

## Reading Order

```
PRD.md (master) → REQUIREMENTS_DATABASE.md (foundation)
                            ↓
           ┌────────────────┼────────────────┐
           ↓                ↓                ↓
    CORE (accounts)   MULTI_CURRENCY    PLUGIN_SYSTEM
           ↓                ↓                ↓
    JOURNAL (entries)  RATES (rates)        ↓
           ↓                ↓                ↓
    QUERY_ENGINE    REPORTS (statements)    ↓
           ↓                ↓                ↓
    BUDGETS         ADMIN (mgmt)            ↓
```

---

## Key References

| Feature | Requirements File | Backend Module | Frontend Path |
|---------|-------------------|----------------|---------------|
| Accounts | CORE, DATABASE | `accounts/` | `(dashboard)/accounts/` |
| Journal | CORE, API | `journal/` | `(dashboard)/journal/` |
| Currencies | MULTI_CURRENCY | `currencies/` | `(dashboard)/settings/currencies/` |
| Exchange Rates | MULTI_CURRENCY | `rates/`, `providers/` | `components/rates/` |
| Balance Query | QUERY_ENGINE | `query/` | API calls only |
| Reports | REPORTS, API | `reports/` | `(dashboard)/reports/` |
| Budgets | BUDGETS | `budgets/` | `components/budgets/` |
| Admin | ADMIN, API | `admin/` | `app/admin/` |
| Plugin System | PLUGIN_SYSTEM | `providers/` | `(dashboard)/settings/providers/` |

---

## Convention: MUST/SHOULD Notation

All requirements use RFC 2119 keywords:

| Keyword | Meaning |
|---------|---------|
| **MUST** | Absolute requirement |
| **MUST NOT** | Absolute prohibition |
| **SHOULD** | Recommendation (can deviate with reason) |
| **SHOULD NOT** | Recommendation against |
| **MAY** | Optional feature |

---

## Anti-Patterns (THIS DOMAIN)

- **NEVER** duplicate requirements across files (single source of truth)
- **NEVER** mix business logic with implementation details
- **NEVER** reference external URLs (can rot)
- **SHOULD** include acceptance criteria for each feature
- **SHOULD** link to relevant API endpoints

---

## Cross-References

- **Master**: `../PRD.md`
- **Database**: `REQUIREMENTS_DATABASE.md` (referenced by all)
- **API**: `REQUIREMENTS_API.md` (referenced by feature requirements)
