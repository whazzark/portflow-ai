# syntax=docker/dockerfile:1

# Build context is the repo root (pnpm workspace), not apps/api.
# docker build -f apps/api/Dockerfile .

FROM node:24-slim AS deps
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @portflow/api...

FROM node:24-slim AS build
WORKDIR /repo
RUN corepack enable
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --dir apps/api build

FROM node:24-slim AS runtime
WORKDIR /app
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo/apps/api/build ./
RUN pnpm install --prod
USER node
EXPOSE 3333
CMD ["node", "bin/server.js"]
