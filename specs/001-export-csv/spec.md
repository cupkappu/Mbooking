# Feature Specification: CSV Export for Bills and Accounts

**Feature Branch**: `001-export-csv`  
**Created**: 2026-01-23  
**Status**: Draft  
**Input**: User description: "用户可以把账单、账户导出成csv"

## User Scenarios & Testing

### User Story 1 - Export Bills to CSV (Priority: P1)

As a user, I want to export my bills (journal entries) to a CSV file so that I can backup my financial data or import it into other applications.

**Why this priority**: This is the primary use case for data portability. Users need to be able to extract their financial records for external analysis, tax preparation, or backup purposes. This delivers immediate value and is a standalone MVP feature.

**Independent Test**: Can be fully tested by navigating to the bills section, clicking the export button, receiving a CSV file, and verifying the file contains the expected bill data with correct formatting. Delivers value by enabling data portability.

**Acceptance Scenarios**:

1. **Given** the user has access to the bills section, **When** the user clicks the "Export to CSV" button, **Then** the system downloads a CSV file containing the user's bills with columns for date, description, debit account, credit account, and amount.

2. **Given** the user has no bills in the system, **When** the user attempts to export bills, **Then** the system either downloads an empty CSV with headers or shows a user-friendly message indicating no data to export.

3. **Given** the user has bills across multiple dates, **When** the user exports bills, **Then** the CSV file includes all bills regardless of their transaction dates.

---

### User Story 2 - Export Accounts to CSV (Priority: P1)

As a user, I want to export my account hierarchy to a CSV file so that I can review my account structure externally or migrate data to another system.

**Why this priority**: Account structure is fundamental to the double-entry bookkeeping system. Exporting accounts enables users to analyze their chart of accounts, share account lists with accountants, or maintain offline records. This is equally critical as bill export.

**Independent Test**: Can be fully tested by navigating to the accounts section, clicking the export button, receiving a CSV file, and verifying the file contains the account hierarchy with correct parent-child relationships and account attributes. Delivers value by enabling account data portability.

**Acceptance Scenarios**:

1. **Given** the user has accounts in the system, **When** the user clicks the "Export to CSV" button, **Then** the system downloads a CSV file containing all accounts with columns for account name, account type, parent account, balance, and currency.

2. **Given** the user has a hierarchical account structure (nested accounts), **When** the user exports accounts, **Then** the CSV reflects the hierarchy relationship through parent account references.

3. **Given** the user has no accounts in the system, **When** the user attempts to export accounts, **Then** the system either downloads an empty CSV with headers or shows a user-friendly message indicating no data to export.

---

### User Story 3 - Filter Export Data (Priority: P2)

As a user, I want to filter which bills are exported so that I can export only relevant data for specific time periods or account categories.

**Why this priority**: While basic export is P1, filtering enhances usability for users with large datasets. They may only need recent transactions or specific account types for their analysis. This improves the feature without being essential for MVP.

**Independent Test**: Can be fully tested by applying date and account filters before export and verifying the CSV contains only filtered data. Delivers value by reducing data noise and file size.

**Acceptance Scenarios**:

1. **Given** the user has bills across multiple months, **When** the user selects a date range and exports bills, **Then** the CSV contains only bills within the selected date range.

2. **Given** the user wants to export bills from specific account types, **When** the user filters by account type and exports, **Then** the CSV contains only bills involving the selected account types.

---

### Edge Cases

- What happens when the user has thousands of bills - does the system handle large exports gracefully?
- What happens during export if the user loses network connectivity?
- How does the system handle special characters in bill descriptions or account names (commas, quotes, newlines)?
- What happens if the CSV generation fails due to server errors - is the user notified?
- How does the system handle multi-currency data in CSV format - what currency format is used?
- What happens when exporting accounts with circular parent-child relationships (data corruption)?

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow users to initiate CSV export of bills from the bills section via a clearly visible export button.
- **FR-002**: System MUST allow users to initiate CSV export of accounts from the accounts section via a clearly visible export button.
- **FR-003**: System MUST generate CSV files with UTF-8 encoding to support all characters in Chinese and other languages.
- **FR-004**: System MUST include appropriate column headers in the first row of CSV exports for both bills and accounts.
- **FR-005**: System MUST handle special characters (commas, quotes, newlines) in data fields by properly escaping them in the CSV format.
- **FR-006**: System MUST provide appropriate error messages to users if the export fails.
- **FR-007**: System MUST include all user data in exports without truncation, respecting tenant isolation (users only see their own data).
- **FR-008**: System MUST allow users to filter bills by date range before export using a date picker with preset options (last 30 days, last 90 days, this year, all time) and custom date range.
- **FR-009**: System MUST allow users to filter accounts by account type before export.

### Key Entities

- **Bill (Journal Entry)**: Represents a financial transaction in double-entry bookkeeping. Key attributes include transaction date, description, debit account reference, credit account reference, amount, and currency.
- **Account**: Represents a category in the chart of accounts. Key attributes include account name, account type (Assets, Liabilities, Equity, Revenue, Expense), parent account reference for hierarchy, and current balance.
- **Export Request**: Represents the user's action of requesting a CSV export. Captures export type (bill/account), filter criteria, and timestamp for audit purposes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can initiate a bill or account CSV export and receive the file within 10 seconds for datasets up to 10,000 records.
- **SC-002**: 95% of export attempts result in a successfully downloaded CSV file without user-facing errors.
- **SC-003**: Users can open exported CSV files in common spreadsheet applications (Excel, Google Sheets) without data corruption or encoding issues.
- **SC-004**: Exported CSV files maintain data integrity with all records preserved and correctly formatted fields.
