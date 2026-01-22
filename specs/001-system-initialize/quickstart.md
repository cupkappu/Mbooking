# Quickstart: System Initialization Feature

## Environment Setup

### Required Environment Variables

Add to `.env`:

```bash
# Required for initialization
INIT_SECRET=your-secure-random-secret-key-min-32-chars
```

### Development Mode

For local development without seeding:

```bash
# Disable automatic admin seed
SKIP_AUTO_SEED=true
```

## Development Commands

```bash
# Start backend
cd backend && npm run start:dev

# Start frontend
cd frontend && npm run dev

# Run backend tests
cd backend && npm run test -- --testPathPattern=setup

# Run frontend tests
cd frontend && npm run test -- --testPathPattern=setup
```

## API Endpoints

### Check Initialization Status

```bash
curl http://localhost:3001/api/v1/setup/status
```

Response:
```json
{
  "initialized": false,
  "userCount": 0
}
```

### Initialize System

```bash
curl -X POST http://localhost:3001/api/v1/setup/initialize \
  -H "Content-Type: application/json" \
  -H "X-Init-Secret: your-secure-random-secret-key-min-32-chars" \
  -d '{
    "email": "admin@example.com",
    "password": "SecureP@ss123!",
    "name": "Administrator"
  }'
```

## Frontend Pages

| Route | Purpose |
|-------|---------|
| `/setup` | Initialization form (shown when no users exist) |
| `/login` | Normal login (shown after initialization) |

## Testing Checklist

- [ ] Empty database redirects to `/setup`
- [ ] Form validation shows appropriate errors
- [ ] Successful initialization creates user and tenant
- [ ] Default currencies are seeded
- [ ] Subsequent visits show login page
- [ ] Access without INIT_SECRET returns 403
- [ ] Already initialized system returns 409

## Troubleshooting

### "System already initialized" on empty database

Clear database and restart:
```bash
# Drop and recreate database
# Then restart backend
```

### INIT_SECRET validation fails

Verify environment variable is loaded:
```bash
echo $INIT_SECRET
```
