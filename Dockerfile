# DSA Quest — Next.js 16 + Prisma 6
# Two stages: builder (install + compile) → runner (compiled app + node_modules).
# No secrets are needed at build time: course pages are static and the database is only
# touched by API routes at request time. Runtime env: DATABASE_URL, AUTH_SECRET.
# syntax=docker/dockerfile:1

FROM node:22-slim AS base
# Prisma's query engine links against OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── builder ────────────────────────────────────────────────────────────────────
FROM base AS builder
# Manifests + schema first so the install layer is cached; postinstall runs `prisma generate`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

# ── runner ─────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/package.json /app/package-lock.json /app/next.config.ts ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

EXPOSE 3000
CMD ["npm", "start"]
