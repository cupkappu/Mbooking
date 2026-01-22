# Feature Specification: System Initialization Page

**Feature Branch**: `001-system-initialize`  
**Created**: 2026-01-22  
**Status**: Draft  
**Input**: User description: "希望有个系统初始化的页面，在第一次登录（数据库未初始化）的时候可以用于设置初始管理员账户。现在的实现支持做到这一点吗"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-time System Setup (Priority: P1)

As a new user deploying the system for the first time, I want to be guided through an initialization process so that I can create my administrator account and start using the system.

**Why this priority**: This is the critical first step for any new deployment. Without proper initialization, users cannot access the system. This delivers immediate value by enabling system adoption.

**Independent Test**: Can be fully tested by simulating a fresh database and verifying that the initialization flow guides users to successfully create an admin account and access the main application.

**Acceptance Scenarios**:

1. **Given** the database is empty (no users exist), **When** a user visits the application, **Then** they should be automatically redirected to the initialization page instead of the login page.

2. **Given** the user is on the initialization page, **When** they submit valid administrator credentials (email, password, name), **Then** the system should create the admin account and redirect them to the dashboard.

3. **Given** the user has completed initialization, **When** they return to the application, **Then** they should see the normal login page and be able to authenticate with their created credentials.

---

### User Story 2 - Initialization Form Validation (Priority: P1)

As a user completing system setup, I want clear validation feedback so that I can create a valid and secure administrator account.

**Why this priority**: Data quality and security are critical for administrator accounts. Poor validation could lead to weak passwords or invalid emails that lock users out of their own system.

**Independent Test**: Can be tested by submitting various invalid inputs and verifying appropriate error messages are displayed without submitting to the server.

**Acceptance Scenarios**:

1. **Given** the user enters an invalid email format, **When** they attempt to submit, **Then** the system should display a clear email validation error.

2. **Given** the password does not meet security requirements, **When** they attempt to submit, **Then** the system should display specific requirements (minimum length, character types).

3. **Given** the email is already registered, **When** they attempt to submit, **Then** the system should indicate that the system may already be initialized.

---

### User Story 3 - System Already Initialized Flow (Priority: P2)

As a user attempting to access an already-initialized system, I want to see the standard login flow so that I can authenticate normally.

**Why this priority**: Prevents confusion when the initialization page is accessed on an already-configured system. Maintains security by not exposing initialization UI to public.

**Independent Test**: Can be tested by accessing the initialization URL on a system with existing users and verifying redirect to login or access denied.

**Acceptance Scenarios**:

1. **Given** users already exist in the database, **When** a user visits the initialization URL, **Then** they should be redirected to the login page or see an access denied message.

2. **Given** the system is initialized, **When** the initialization API is called, **Then** the request should be rejected with an appropriate error.

---

### User Story 4 - Seed Initial Data (Priority: P2)

As a new user completing system setup, I want essential default data to be created automatically so that the system is ready for immediate use.

**Why this priority**: Provides a better out-of-box experience by pre-populating currencies and default settings, reducing initial configuration burden.

**Independent Test**: Can be verified by checking that currencies, default accounts, or other seed data are available after initialization completes.

**Acceptance Scenarios**:

1. **Given** the user completes initialization, **When** they visit the currencies management page, **Then** default currencies should already exist.

2. **Given** the user completes initialization, **When** they view account settings, **Then** default system preferences should be configured.

---

### Edge Cases

- What happens when database connection fails during initialization?
- How does system handle concurrent initialization requests?
- What if the initialization process is interrupted halfway?
- How does initialization work with the existing seed service (AdminUserSeedService)?
- Should there be a way to reset/re-initialize for development purposes?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect when the database contains no users and redirect to initialization flow instead of normal authentication.
- **FR-002**: System MUST provide a dedicated initialization page with a form for creating the initial administrator account.
- **FR-003**: System MUST validate administrator email format before submission.
- **FR-004**: System MUST enforce minimum password security requirements (length, character types).
- **FR-005**: System MUST create the administrator user with the 'admin' role upon successful initialization.
- **FR-006**: System MUST automatically create the first tenant for the administrator user.
- **FR-007**: System MUST seed default currency data upon successful initialization.
- **FR-008**: System MUST prevent access to initialization page or API once users exist. Access during initial setup requires a secret key defined in environment variable (INIT_SECRET).
- **FR-009**: System MUST log the initialization event for audit purposes.
- **FR-010**: System MUST return appropriate error messages for validation failures without revealing sensitive information.

### Key Entities

- **User**: Existing entity (id, email, name, password_hash, role, tenant_id, created_at). System initialization is inferred from the existence of users in this table.
- **Tenant**: Existing entity (id, name, settings, created_at).
- No additional initialization state entity required - initialization status is determined by checking if any users exist.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete system initialization and create an administrator account in under 5 minutes from first page load.
- **SC-002**: 100% of initialization attempts result in a usable admin account (no partial states).
- **SC-003**: Validation errors are displayed within 500ms of invalid input submission.
- **SC-004**: Zero unauthorized users can access the initialization flow after system setup is complete.
- **SC-005**: Default currencies are available immediately after initialization without requiring additional setup steps.

## Assumptions

- The system uses a relational database (PostgreSQL) with TypeORM entities.
- Existing User and Tenant entities can be leveraged for the initial admin account.
- Current seed services (AdminUserSeedService) should be disabled or modified when initialization UI is enabled.
- Environment variable configuration remains separate from user-created configuration.

## Dependencies

- Backend authentication module (AuthService, User entity, Tenant entity).
- Frontend authentication pages (login, auth-options).
- Existing seed services for currencies and default data.

## Out of Scope

- Password reset functionality (separate feature).
- Multi-factor authentication during setup.
- User invitation/team management (post-initialization features).
- System settings configuration during initialization (organization name, timezone, default currency).
- Database migration or schema setup (assumes database infrastructure exists).

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Users locked out if initialization fails | High | Ensure transactional creation, provide retry mechanism |
| Concurrent initialization attempts | Medium | Use database locking or flag-based prevention |
| Seed services conflict with initialization | Medium | Disable automatic seed when initialization feature is enabled |

## Clarifications

### Session 2026-01-22

- Q: InitializationState 实现方式 → A: Inferred from user count (check if users exist)
- Q: 初始化访问控制 → A: Require secret key in environment variable
- Q: 开发/测试环境初始化处理 → A: All environments behave identically
- Q: 初始化范围 → A: Only create admin account (system settings later)

## Open Questions

*(All critical questions resolved)*
