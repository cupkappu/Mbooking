# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV JSON_LOGS=true

# Install wget for healthcheck
RUN apk add --no-cache wget

# Create non-root user with unique UID (avoid conflicts)
# Use high UID to avoid conflicts with host users
RUN addgroup --system --gid 99999 appgroup && \
    adduser --system --uid 99999 appuser

# Copy necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy plugins directory
COPY --from=builder /app/plugins ./plugins

# Copy config and migrations for TypeORM CLI
COPY --from=builder /app/src/config ./src/config
COPY --from=builder /app/src/migrations ./src/migrations
COPY --from=builder /app/tsconfig.json ./

# Install ts-node for migration CLI (only for dev/test, not production)
RUN npm install --production=false ts-node 2>/dev/null || true

# Change ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 3001

CMD ["node", "dist/main"]
