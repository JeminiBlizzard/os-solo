# Base stage with Node.js and pnpm
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/ui/package.json ./packages/ui/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/agent-runtime/package.json ./packages/agent-runtime/
COPY packages/integrations/package.json ./packages/integrations/
RUN pnpm install --frozen-lockfile

# Build stage
FROM deps AS build
COPY . .
RUN pnpm --filter @os-solo/shared build
RUN pnpm --filter @os-solo/db build
RUN pnpm --filter @os-solo/agent-runtime build || true
RUN pnpm --filter @os-solo/ui build
RUN pnpm --filter @os-solo/api build

# Runtime stage - copy full workspace with all node_modules symlinks intact
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy root config and node_modules (includes .pnpm with all deps)
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules

# Copy each package with its node_modules (contains workspace symlinks)
COPY --from=build /app/packages/api/package.json ./packages/api/
COPY --from=build /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=build /app/packages/api/dist ./packages/api/dist

COPY --from=build /app/packages/db/package.json ./packages/db/
COPY --from=build /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/drizzle ./packages/db/drizzle

COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

COPY --from=build /app/packages/agent-runtime/package.json ./packages/agent-runtime/
COPY --from=build /app/packages/agent-runtime/node_modules ./packages/agent-runtime/node_modules
COPY --from=build /app/packages/agent-runtime/dist ./packages/agent-runtime/dist

# Copy UI dist only (static files served by API)
COPY --from=build /app/packages/ui/dist ./packages/ui/dist

# Set production environment
ENV NODE_ENV=production
ENV PORT=3200

EXPOSE 3200

CMD ["node", "packages/api/dist/index.js"]
