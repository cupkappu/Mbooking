# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set build-time environment variables
ENV NEXT_PUBLIC_API_URL=http://backend:3001

RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Set runtime environment variables
ENV NEXT_PUBLIC_API_URL=http://backend:3001
ENV NEXTAUTH_SECRET=dev-secret-change-in-production
ENV NEXTAUTH_URL=http://localhost:8068

# Create non-root user with unique UID (avoid conflicts)
# Use high UID to avoid conflicts with host users
RUN addgroup --system --gid 99999 appgroup && \
    adduser --system --uid 99999 appuser

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Change ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
