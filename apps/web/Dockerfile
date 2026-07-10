# syntax=docker/dockerfile:1

# Build context is the repo root (pnpm workspace), not apps/web.
# docker build -f apps/web/Dockerfile --build-arg VITE_API_BASE_URL=https://api.example.com .

FROM node:24-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @portflow/web...
COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm --dir apps/web build

FROM nginxinc/nginx-unprivileged:alpine AS runtime
COPY --from=build --chown=nginx:nginx /repo/apps/web/dist /usr/share/nginx/html
COPY --chown=nginx:nginx apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
