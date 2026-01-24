# Feature Specification: Journal Entry Auto-Balance

**Feature Branch**: `004-journal-auto-balance`
**Created**: 2026-01-24
**Status**: Draft
**Input**: User description: "为新增journal entry新增功能：自动平衡。若有多条lines（2条或以上）且仅有一个line的金额为空或0，点击这个按钮1. 仅有一个货币的时候可以自动填充平衡金额。2. 有多个货币的时候，先在这个为空的line自动填充一个货币的平衡金额（需要对应货币），然后新增一个和刚刚为空的line同样账户的line，填充下一个货币的平衡金额。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single Currency Auto-Balance (Priority: P1)

As an accountant creating a journal entry with a single currency, I want the system to automatically calculate and fill the balancing amount when one line has no amount, so that I can quickly complete balanced journal entries without manual calculation.

**Why this priority**: This is the most common scenario for daily accounting work. It delivers immediate time savings and reduces calculation errors for single-currency transactions, which represent the majority of journal entries.

**Independent Test**: Can be fully tested by creating a journal entry with 2+ lines in the same currency, leaving one line's amount empty, clicking the auto-balance button, and verifying that the entry becomes balanced (sum equals zero).

**Acceptance Scenarios**:

1. **Given** a new journal entry with 3 lines in USD currency, **When** the amounts are: Line1=1000, Line2=1000, Line3=(empty), **And** the user clicks "Auto-Balance", **Then** Line3 should be automatically filled with -2000, making the total 0.

2. **Given** a new journal entry with 2 lines in the same currency, **When** the amounts are: Line1=500, Line2=(empty), **And** the user clicks "Auto-Balance", **Then** Line2 should be automatically filled with -500.

3. **Given** a journal entry with 4 lines in the same currency, **When** the amounts are: Line1=100, Line2=200, Line3=(0), Line4=(empty), **And** the user clicks "Auto-Balance", **Then** Line4 should be automatically filled with -300, and Line3 should remain 0 (not changed).

---

### User Story 2 - Multi-Currency Auto-Balance (Priority: P1)

As an accountant creating a multi-currency journal entry, I want the system to automatically create balancing lines for each currency group, so that I can efficiently handle complex currency transactions without manually creating multiple lines.

**Why this priority**: Multi-currency transactions are common in international business. This feature significantly reduces the complexity of creating balanced multi-currency entries and prevents calculation errors across currency groups.

**Independent Test**: Can be fully tested by creating a journal entry with multiple currencies, leaving one line's amount empty, clicking the auto-balance button, and verifying that:
- The empty line is filled with the correct balancing amount for its currency
- Additional lines are created for other currency groups
- All currency groups sum to zero

**Acceptance Scenarios**:

1. **Given** a journal entry with 3 lines (USD: Line1=1000, Line2=(empty USD), CNY: Line3=-600), **When** the user clicks "Auto-Balance", **Then** Line2 should be filled with -1000 USD, **And** a new Line4 should be created with account=Line2's account, currency=CNY, amount=+600.

2. **Given** a journal entry with multiple currency groups, **When** the user clicks "Auto-Balance", **Then** exactly one new line should be created for each additional currency group beyond the empty line's currency.

---

### User Story 3 - Auto-Balance Button Availability (Priority: P2)

As a user creating journal entries, I want the auto-balance button to only be enabled when the preconditions are met, so that I understand when the feature is applicable and avoid confusion.

**Why this priority**: Clear UI state management prevents user errors and sets correct expectations. Users should not attempt to use features that don't apply to their current situation.

**Independent Test**: Can be tested by verifying that the auto-balance button is disabled/hidden when:
- Fewer than 2 lines exist
- Multiple lines have empty or zero amounts
- All lines already have amounts (entry is already balanced)

**Acceptance Scenarios**:

1. **Given** a journal entry with only 1 line, **When** the user views the entry form, **Then** the Auto-Balance button should not be visible or should be disabled.

2. **Given** a journal entry with 3 lines where 2 lines have empty amounts, **When** the user views the entry form, **Then** the Auto-Balance button should be disabled with a tooltip explaining why.

3. **Given** a journal entry with 4 lines that are already balanced, **When** the user views the entry form, **Then** the Auto-Balance button should not be available.

---

### User Story 4 - Error Handling and Validation (Priority: P2)

As a user, I want clear feedback when auto-balance cannot be completed, so that I understand the issue and can take corrective action.

**Why this priority**: Graceful error handling improves user experience and prevents frustration when unexpected conditions arise.

**Independent Test**: Can be tested by attempting auto-balance in scenarios where it should fail (e.g., missing exchange rates for multi-currency, invalid account states) and verifying appropriate error messages.

**Acceptance Scenarios**:

1. **Given** a journal entry where the empty line's account is invalid or deleted, **When** the user clicks Auto-Balance, **Then** an error should be displayed and no changes should be made.

---

### Edge Cases

- ~~What happens when the empty line has a negative amount (should it be treated as empty)?~~ → Resolved: Only null/undefined/0 are empty; negative amounts are valid
- How does the system handle very small amounts (near-zero due to floating-point precision)?
- How does the feature interact with other unsaved changes in the journal entry?
- What if the calculated balancing amount exceeds reasonable limits (fraud prevention)?
- How does the system handle account types that don't support certain currencies?
- How does this feature work with the existing draft/pending state of journal entries?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an "Auto-Balance" button in the journal entry creation/edit form that is visible only when 2 or more lines exist.
- **FR-002**: System MUST enable the Auto-Balance button only when exactly one line has an amount that is null, undefined, or zero.
- **FR-003**: System MUST calculate the balancing amount as the negative sum of all non-zero amounts in the same currency group.
- **FR-004**: For single currency entries, System MUST automatically fill the empty line's amount with the calculated balancing amount.
- **FR-005**: For multi-currency entries, System MUST first fill the empty line's amount with its currency's balancing amount.
- **FR-006**: For multi-currency entries, System MUST create exactly one new line for each additional currency group, using the same account as the empty line.
- **FR-007**: System MUST calculate the amount for each new multi-currency line as the negative sum of all non-zero amounts in that currency group.
- **FR-008**: System MUST validate that the entry is balanced after auto-balance (sum of each currency group equals zero).
- **FR-009**: System MUST provide clear error messages when auto-balance cannot complete due to invalid states.
- **FR-010**: System MUST NOT modify any existing line amounts except the empty line(s) specified in the precondition.
- **FR-011**: System MUST preserve all other line attributes (account, currency, tags, remarks) when creating new lines.
- **FR-012**: System MUST allow any authenticated user with journal entry creation permissions to use the auto-balance feature.

### Key Entities

- **JournalEntry**: Existing entity containing the overall transaction (id, date, description, tenant_id, created_by). The auto-balance feature operates on the lines within this entity.
- **JournalLine**: Existing entity representing individual entry lines (id, journal_entry_id, account_id, amount, currency, tags, remarks). Auto-balance modifies amounts and adds new line instances.
- **Account**: Existing entity referenced by JournalLine. Used to create new lines with the same account as the empty line.
- **Currency**: Existing entity for currency validation. Used to identify currency groups and validate currency codes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully auto-balance single-currency journal entries with 2+ lines in 100% of valid cases (exactly one empty line).
- **SC-002**: Users can successfully auto-balance multi-currency journal entries with 2+ lines in 100% of valid cases.
- **SC-003**: Auto-balanced entries pass balance validation (each currency group sums to zero) in 100% of successful operations.
- **SC-004**: Zero unauthorized modifications occur - auto-balance only modifies the empty line and adds new lines as specified.
- **SC-005**: Error messages for failed auto-balance operations are displayed within 1 second of operation attempt.
- **SC-006**: Auto-balance operation completes within 2 seconds for entries with up to 20 lines.

## Assumptions

- Auto-balance is performed entirely on the frontend for unsaved entries.
- The existing balance validation logic in `JournalService.validateBalancedLines()` remains the source of truth when the entry is finally submitted to the backend.
- The frontend journal entry form already supports dynamic line addition and removal.
- Currency groups are determined by distinct currency values across all lines in the entry.
- The "same account" requirement for new multi-currency lines means copying the `account_id` from the empty line.
- Empty amounts are defined as `null`, `undefined`, or numeric zero (0). Negative amounts are valid amounts and will not be treated as empty.
- New lines created by auto-balance are added to the in-memory entry state before submission.

## Dependencies

- Frontend journal entry form components for button placement and triggering.
- Frontend state management for tracking line changes and button enablement state.

## Out of Scope

- Auto-balance for entries with multiple empty lines (requires different UX/workflow).
- Automatic currency conversion between lines (lines maintain their original currencies).
- Auto-balance for existing saved journal entries (only applies to new/in-progress entries).
- Suggestions for which line should be empty (user must manually select/set the empty line).
- Integration with recurring journal entry templates.
- Batch auto-balance for multiple entries at once.
- Undo/revert functionality for auto-balance operations (handled by normal form undo).

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Users create unbalanced entries due to incorrect assumptions about which line to leave empty | Medium | Clear UI labeling and tooltips explaining the expected pattern |
| Large balancing amounts could indicate data entry errors or fraud | Low | Consider adding optional warning thresholds for large amounts |
| Performance degradation with very large number of lines | Low | Set reasonable limits on line count and test with realistic volumes |

## Clarifications

### Session 2026-01-24

- Q: User role and permissions for auto-balance feature → A: Any authenticated user can use auto-balance
- Q: Auto-balance implementation location → A: Frontend-only calculation, no backend changes needed
- Q: Negative amount handling → A: Only null/undefined/0 are empty; negative amounts are valid amounts

## Open Questions

*(All critical questions resolved)*
