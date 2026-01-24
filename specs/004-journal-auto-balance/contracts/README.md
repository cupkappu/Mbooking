# Contracts: Journal Entry Auto-Balance

**Note**: This feature requires NO API contracts or backend changes.

The auto-balance feature operates entirely on frontend in-memory state:

1. **No new API endpoints** - Uses existing journal entry create/update endpoints
2. **No new data structures** - Operates on existing JournalLine form state
3. **No new validations** - Relies on existing backend validation on submit

## Existing API (unchanged)

The entry is submitted through the existing API when the user clicks "Submit":

```
POST /api/v1/journal/entries
PUT  /api/v1/journal/entries/:id
```

Request body format is unchanged. Auto-balance simply modifies the `lines` array before submission.

## Frontend-Only Flow

```
User clicks Auto-Balance
        │
        ▼
Frontend: calculateAutoBalance(lines)
        │
        ├─ Success: Update lines state
        │
        └─ Failure: Show error message
        │
        ▼
User reviews and clicks Submit
        │
        ▼
Existing API receives modified lines
        │
        ▼
Backend: validateBalancedLines() [unchanged]
        │
        ▼
Entry saved or error returned
```
