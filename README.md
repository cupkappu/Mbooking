# Multi-Currency Personal Accounting Software

<p align="center">
  <img src="docs/screenshots/dashboard-preview.png" alt="Dashboard Preview" width="800"/>
</p>

<p align="center">
  <strong>A beautiful, full-featured personal accounting software with multi-currency support and double-entry bookkeeping.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#documentation">Documentation</a>
</p>

---

## Features

### Core Accounting

- **Double-Entry Bookkeeping**: Full support for the five account categories (Assets, Liabilities, Equity, Revenue, Expense) with automatic balance validation
- **Multi-Currency**: Native support for multiple currencies with exchange rate tracking and automatic conversion
- **Hierarchical Accounts**: Unlimited nested account structure with path-based navigation and depth control
- **Journal Entries**: Create balanced transactions with multiple line items, tags, and remarks
- **Transaction States**: Draft (pending), confirmed, and voided states for complete audit trail

### Query & Reporting

- **Query Engine**: Flexible balance queries with depth merging and progressive loading
- **Balance Sheet**: Generate comprehensive financial statements showing assets, liabilities, and equity
- **Income Statement**: Track revenue and expenses over any time period
- **Cash Flow Analysis**: Monitor money movement across accounts
- **Query Caching**: Intelligent caching for fast response on large datasets

### Budget Management

- **Periodic Budgets**: Set monthly, weekly, or yearly spending limits
- **Non-Periodic Budgets**: Track one-time spending goals
- **Progress Tracking**: Real-time budget progress with alert thresholds
- **Category-Based**: Create budgets for specific expense categories

### Exchange Rates

- **Plugin System**: Extendable rate providers supporting both JS plugins and REST APIs
- **Rate History**: Automatic historical rate recording
- **Scheduled Fetching**: Automatic rate updates at configurable intervals
- **Multiple Providers**: Support for multiple rate sources with fallback

### Security & Multi-Tenancy

- **Row Level Security (RLS)**: PostgreSQL RLS for complete data isolation
- **Multi-Tenancy**: Each user's data is completely isolated
- **Authentication**: Auth.js with credentials, OAuth (Google), and Authelia support
- **JWT Tokens**: Secure API authentication with JWT

## Screenshots

> **Note**: Screenshots will be added in a future update. For now, please run the application locally to see the UI.

### Dashboard

The main dashboard provides a quick overview of your finances:

- Total assets and liabilities summary
- Monthly income vs expenses
- Recent transactions
- Account balance breakdown by category

### Account Management

Hierarchical account tree view with:

- Collapsible branches for nested accounts
- Real-time balance display per account
- Support for five account types
- Currency indicator per account

### Journal Entry

Double-entry bookkeeping interface:

- Multi-line transaction entry
- Automatic balance validation
- Tag-based categorization
- Searchable transaction history

### Reports

Financial statements including:

- Balance Sheet
- Income Statement
- Cash Flow Statement
- Custom date range filtering

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| [Next.js 14](https://nextjs.org/) | React framework with App Router |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework |
| [shadcn/ui](https://ui.shadcn.com/) | Beautiful, customizable UI components |
| [React Query](https://tanstack.com/query) | Server state management |
| [Auth.js](https://authjs.dev/) | Authentication |

### Backend

| Technology | Purpose |
|------------|---------|
| [NestJS 10](https://nestjs.com/) | Node.js enterprise framework |
| [TypeORM](https://typeorm.io/) | Database ORM |
| [PostgreSQL 15](https://www.postgresql.org/) | Relational database |
| [Passport JWT](http://www.passportjs.org/) | Authentication middleware |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| [Docker](https://www.docker.com/) | Containerization |
| [Docker Compose](https://docs.docker.com/compose/) | Multi-container orchestration |

## Quick Start

### Prerequisites

| Requirement | Minimum Version | Recommended |
|-------------|-----------------|-------------|
| Node.js | 20.x | 20.x LTS |
| Docker Desktop | Latest | Latest |
| npm | 9.x | Latest |

### Installation

#### 1. Clone the repository

```bash
git clone <repository-url>
cd multi_currency_accounting
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration. See [Configuration](#configuration) for details.

#### 4. Start with Docker Compose

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database (port 5432)
- Backend API (port 8067, internal: 3001)
- Frontend application (port 8068, internal: 3000)

#### 5. Access the application

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:8068 | Main application |
| Backend API | http://localhost:8067 | REST API |
| API Docs | http://localhost:8067/api/docs | Swagger documentation |

### Local Development

For development with hot-reload:

```bash
# Terminal 1 - Backend (runs on port 3001)
cd backend && npm run start:dev

# Terminal 2 - Frontend (runs on port 3000)
cd frontend && npm run dev
```

The frontend will be available at http://localhost:3000, and it will proxy API requests to the backend.

## Deployment

### Docker Production Deployment

#### 1. Build and start containers

```bash
docker-compose up -d --build
```

#### 2. Verify services are running

```bash
docker-compose ps
```

Expected output:
```
NAME                 STATUS    PORTS
accounting-backend   Up        0.0.0.0:8067->3001/tcp
accounting-db        Up        0.0.0.0:5432->5432/tcp
accounting-frontend  Up        0.0.0.0:8068->3000/tcp
```

#### 3. Check logs

```bash
docker-compose logs -f
```

### Production with Custom Ports

Edit `docker-compose.yml` to customize port mappings:

```yaml
services:
  frontend:
    ports:
      - "80:3000"  # Change external port from 8068 to 80

  backend:
    ports:
      - "8080:3001"  # Change external port from 8067 to 8080
```

### Reverse Proxy Configuration

When deploying behind a reverse proxy (nginx, Traefik, Caddy), ensure the following headers are passed:

```nginx
# Nginx example
location / {
    proxy_pass http://localhost:8068;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

location /api/ {
    proxy_pass http://localhost:8067;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Environment Variables for Production

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Long random string for JWT signing (min 32 chars) |
| `NEXTAUTH_SECRET` | Yes | Random string for NextAuth.js |
| `NEXTAUTH_URL` | Yes | Production URL (e.g., https://accounting.example.com) |
| `DATABASE_HOST` | Yes | Database hostname |
| `DATABASE_PASSWORD` | Yes | Strong database password |

## Configuration

### Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

#### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_HOST` | `localhost` | PostgreSQL host |
| `DATABASE_PORT` | `5432` | PostgreSQL port |
| `DATABASE_USER` | `accounting` | Database user |
| `DATABASE_PASSWORD` | `secret` | Database password |
| `DATABASE_NAME` | `accounting` | Database name |

#### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | JWT signing secret (required) |
| `NEXTAUTH_SECRET` | - | NextAuth.js secret (required) |
| `NEXTAUTH_URL` | `http://localhost:3000` | NextAuth URL |
| `NEXTAUTH_URL` | `http://localhost:8068` | Production URL when using Docker |

#### OAuth (Optional)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

#### Authelia (Optional)

| Variable | Description |
|----------|-------------|
| `AUTHELIA_URL` | Authelia server URL |
| `AUTHELIA_API_KEY` | Authelia API key |

#### API Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend API URL |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origins |

### Docker Services

| Service | External Port | Internal Port | Description |
|---------|---------------|---------------|-------------|
| PostgreSQL | 5432 | 5432 | Database |
| Backend | 8067 | 3001 | API server |
| Frontend | 8068 | 3000 | Web application |

## Project Structure

```
multi_currency_accounting/
├── frontend/                    # Next.js 14 frontend (App Router)
│   ├── app/                     # App Router pages
│   │   ├── (auth)/             # Authentication pages (login, register)
│   │   ├── (dashboard)/        # Main application
│   │   │   ├── dashboard/      # Dashboard overview
│   │   │   ├── accounts/       # Account management
│   │   │   ├── journal/        # Journal entries
│   │   │   ├── reports/        # Financial reports
│   │   │   ├── budgets/        # Budget management
│   │   │   └── settings/       # User settings
│   │   ├── admin/              # Admin panel
│   │   │   ├── currencies/     # Currency management
│   │   │   ├── providers/      # Rate provider management
│   │   │   └── users/          # User management
│   │   └── api/                # Next.js API routes
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── accounts/           # Account-related components
│   │   ├── journal/            # Journal entry components
│   │   ├── reports/            # Report components
│   │   └── rates/              # Rate/currency components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities and configurations
│   └── types/                  # TypeScript type definitions
│
├── backend/                     # NestJS 10 backend
│   ├── src/
│   │   ├── auth/              # Authentication module
│   │   ├── accounts/          # Account management
│   │   ├── journal/           # Journal entries
│   │   ├── query/             # Query engine
│   │   ├── rates/             # Exchange rate engine
│   │   ├── providers/         # Provider plugin system
│   │   ├── scheduler/         # Scheduled tasks
│   │   ├── budgets/           # Budget management
│   │   ├── reports/           # Report generation
│   │   ├── currencies/        # Currency management
│   │   ├── tenants/           # Multi-tenancy
│   │   └── common/            # Shared utilities
│   ├── plugins/               # Rate provider plugins
│   │   └── js/                # JS plugin directory
│   └── test/                  # Backend tests
│
├── database/
│   ├── migrations/            # TypeORM migrations
│   └── seeders/               # Database seed data
│
├── docs/                       # Documentation
│   ├── requirements/          # Feature requirements
│   │   ├── REQUIREMENTS_API.md
│   │   ├── REQUIREMENTS_DATABASE.md
│   │   └── ...
│   └── plans/                 # Design documents
│
├── scripts/                    # Utility scripts
├── e2e/                        # Playwright E2E tests
├── docker-compose.yml          # Docker Compose config
├── docker-compose.test.yml     # Test environment config
├── package.json               # Root package.json
└── playwright.config.ts       # Playwright configuration
```

## Documentation

| Document | Description |
|----------|-------------|
| [PRD](docs/PRD.md) | Product Requirements Document |
| [API Requirements](docs/requirements/REQUIREMENTS_API.md) | API endpoint specifications |
| [Database Schema](docs/requirements/REQUIREMENTS_DATABASE.md) | Database design and entities |
| [Core Features](docs/requirements/REQUIREMENTS_CORE.md) | Core accounting features |
| [Multi-Currency](docs/requirements/REQUIREMENTS_MULTI_CURRENCY.md) | Currency and exchange rate features |
| [Query Engine](docs/requirements/REQUIREMENTS_QUERY_ENGINE.md) | Query engine specifications |
| [Plugin System](docs/requirements/REQUIREMENTS_PLUGIN_SYSTEM.md) | Provider plugin architecture |
| [Agent Conventions](docs/requirements/AGENTS.md) | Development guidelines |

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js Frontend (Port 3000)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Auth.js   │  │  React Query│  │      shadcn/ui         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Proxy via Next.js)
┌─────────────────────────────────────────────────────────────────┐
│                  NestJS Backend (Port 3001)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Auth Module │  │ Query Engine│  │     Rate Engine        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               PostgreSQL (Port 5432, RLS Enabled)                │
│  ┌───────────────────┐  ┌─────────────────────────────────────┐ │
│  │  Global Schema    │  │    Tenant Schemas (RLS)             │ │
│  │  - currencies     │  │    - accounts                       │ │
│  │  - providers      │  │    - journal_entries                │ │
│  │  - exchange_rates │  │    - budgets                        │ │
│  └───────────────────┘  │    - reports                        │ │
│                         └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

- **Row Level Security**: PostgreSQL RLS ensures complete tenant data isolation
- **Module Pattern**: Each feature in its own directory with entities/, dto/, services/
- **Soft Deletes**: All entities use `deleted_at` column for data preservation
- **Decimal Type**: Money values use DECIMAL type to avoid floating-point errors
- **DTOs**: All API inputs/outputs use class-validator DTOs

## FAQ

### Q: How do I add a new currency?

1. Go to Admin → Currencies in the web interface
2. Click "Add Currency"
3. Enter the currency code (e.g., "USD"), name, and symbol
4. Set decimal places (2 for fiat, 8 for crypto)
5. Save

Or use the API:

```bash
curl -X POST http://localhost:8067/api/v1/currencies \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "USD", "name": "US Dollar", "symbol": "$", "decimal_places": 2}'
```

### Q: How do I configure an exchange rate provider?

1. Go to Admin → Providers in the web interface
2. Click "Add Provider"
3. Select provider type:
   - **REST API**: Configure base URL and API key
   - **JS Plugin**: Point to a plugin file in `backend/plugins/js/`
4. Set supported currencies
5. Save and test the connection

### Q: Can I import data from other accounting software?

Import functionality is planned for a future release. Currently, you can:

1. Use the API to create accounts and journal entries programmatically
2. Export data from your current system to CSV
3. Write a script to parse CSV and call the API

### Q: How do I backup my data?

#### Automated Backups

Set up a cron job for regular database backups:

```bash
# Add to crontab
0 2 * * * pg_dump -h localhost -U accounting accounting > /backup/accounting_$(date +\%Y\%m\%d).sql
```

#### Docker Volume Backup

```bash
# Backup PostgreSQL volume
docker run --rm -v accounting_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

### Q: How do I reset my password?

Currently, password reset requires direct database access. In a future update, this will be available through the UI.

For now, to reset a user's password:

1. Access the PostgreSQL database:

```bash
docker exec -it accounting-db psql -U accounting -d accounting
```

2. Update the password (you'll need to hash it first using bcrypt):

```sql
UPDATE users SET password_hash = '$2b$10$hashed_password_here' WHERE email = 'user@example.com';
```

### Q: What is the "depth" parameter in balance queries?

The `depth` parameter controls how account balances are aggregated:

- `depth: 1`: Shows top-level categories (Assets, Liabilities, etc.)
- `depth: 2`: Shows sub-categories (e.g., Assets:Bank, Assets:Cash)
- `depth: 3`: Shows more detail (e.g., Assets:Bank:Checking)
- `depth: 'all'`: Shows all account levels, individually

Lower depth values are useful for high-level summaries; higher values for detailed breakdowns.

### Q: How do I create my first account?

1. After logging in, go to **Accounts**
2. Click **+ New Account**
3. Enter account details:
   - **Name**: e.g., "Checking Account"
   - **Type**: Select category (Assets, Liabilities, etc.)
   - **Currency**: Select the account's default currency
   - **Parent**: Leave empty for top-level, or select a parent account
4. Click **Save**

### Q: How do I record a transaction?

1. Go to **Journal** → **+ New Entry**
2. Enter transaction details:
   - **Date**: Transaction date
   - **Description**: What the transaction is for
3. Add line items (minimum 2 required for double-entry):
   - Select **Account** and enter **Amount** (negative for debit, positive for credit)
   - Add optional tags and remarks
4. Click **Save** when the total balance is zero

Example: Recording lunch expense
```
Description: Restaurant lunch
  expense:food    -50.00 HKD  [lunch]
  assets:bank     +50.00 HKD
```

### Q: Why does my balance show as negative?

Negative balances are normal for certain account types:

| Account Type | Normal Balance | Interpretation |
|--------------|----------------|----------------|
| Assets | Positive | What you own |
| Liabilities | Negative | What you owe |
| Equity | Negative | Net worth |
| Revenue | Negative | Income accumulation |
| Expenses | Positive | Money spent |

This follows standard accounting conventions where debit balances are positive for asset/expense accounts and credit balances are positive for liability/equity/revenue accounts.

### Q: How do I enable dark mode?

Dark mode support is available in the user settings:

1. Click your user avatar in the top right
2. Select **Settings**
3. Toggle **Dark Mode** in the Appearance section

### Q: Can I use this with Authelia?

Yes. Authelia is supported via Trusted Header SSO:

1. Configure Authelia with your reverse proxy
2. Set the following environment variables:

```env
AUTHELIA_URL=http://your-authelia:9090
AUTHELIA_API_KEY=your-api-key
```

3. Ensure your reverse proxy forwards these headers:
   - `X-Auth-User`: User ID
   - `X-Auth-Email`: User email

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Read the [Agent Conventions](docs/requirements/AGENTS.md) for development guidelines
2. Fork the repository
3. Create a feature branch
4. Make your changes
5. Ensure tests pass
6. Submit a pull request

### Development Guidelines

- Follow the conventions in `docs/requirements/AGENTS.md`
- Use feature branches and create pull requests
- Add proper documentation for new features
- Ensure code passes linting and tests

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

For issues and feature requests, please open a GitHub issue.

---

<p align="center">
  Built with Next.js, NestJS, PostgreSQL, and ❤️
</p>
