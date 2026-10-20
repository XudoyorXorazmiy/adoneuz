# adone.uz — Coolify build (pnpm monorepo, Node 24). openstore naqshi: butun /app ko'chiriladi —
# migratsiya va bootstrap shu konteyner ichidan ishlaydi (docs/DEPLOY.md §5).
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat && corepack enable
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
# Coolify build-time env'larni build-arg sifatida beradi; proxy (edge) ROOT_DOMAIN'ni build paytida oladi.
ARG ROOT_DOMAIN
ARG PUBLIC_URL
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @adone/web build

FROM base AS run
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 MEDIA_DIR=/app/media-data
COPY --from=build /app ./
RUN mkdir -p /app/media-data
EXPOSE 3000
CMD ["pnpm", "--filter", "@adone/web", "exec", "next", "start", "-p", "3000"]
