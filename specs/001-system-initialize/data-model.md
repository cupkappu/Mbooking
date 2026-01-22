# Data Model: System Initialization Page

## Entities

### User (Existing - Reused)

| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| id | UUID | Auto-generated | Primary key |
| email | string | `IsEmail()`, unique | Admin email |
| name | string | `MinLength(1)`, `MaxLength(100)` | Display name |
| password | string | `IsStrongPassword()` | Bcrypt hashed |
| role | string | `'admin'` | Fixed role |
| provider | string | `'credentials'` | Fixed provider |
| is_active | boolean | `true` | Default true |
| tenant_id | UUID | Nullable initially | Set after tenant creation |
| created_at | DateTime | Auto | |
| updated_at | DateTime | Auto | |

### Tenant (Existing - Reused)

| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| id | UUID | Auto-generated | Primary key |
| name | string | `MaxLength(200)` | Default: `${email}'s Tenant` |
| settings | JSONB | Default structure | Default currency, timezone |
| is_active | boolean | `true` | |
| user_id | UUID | | Creator/admin |
| created_at | DateTime | Auto | |
| updated_at | DateTime | Auto | |

## DTOs

### InitializeSystemDto

```typescript
export class InitializeSystemDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
  password: string;

  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  organizationName?: string;
}
```

### InitializeSystemResponseDto

```typescript
export class InitializeSystemResponseDto {
  success: boolean;
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}
```

### InitializationStatusDto

```typescript
export class InitializationStatusDto {
  initialized: boolean;
  userCount: number;
  currencyCount?: number;
}
```

## State Machine

```
[EMPTY] --(create admin)--> [INITIALIZED]
  |
  +--(check status)--> Returns { initialized: false }

[INITIALIZED] --(check status)--> Returns { initialized: true }
  |
  +--(access setup)--> Redirect to login / 403 Forbidden
```

## Validation Rules

### Password Requirements

- Minimum 12 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character: `!@#$%^&*`

### Email Requirements

- Valid email format
- Unique in system (no duplicate users)

## Error Codes

| Code | Message | Scenario |
|------|---------|----------|
| `INIT_ALREADY_DONE` | System is already initialized | Users exist |
| `INIT_INVALID_SECRET` | Invalid initialization secret | Missing/wrong INIT_SECRET |
| `INIT_CONCURRENT` | Initialization already in progress | Race condition |
| `VALIDATION_ERROR` | Field-specific messages | Invalid input |
| `INIT_DB_ERROR` | Database connection failed | Infrastructure issue |
