# adone.uz — Coolify build (pnpm monorepo, Node 24). Yakuniy image — Next.js standalone (BARQARORLIK 3.4): faqat ishlash uchun
# kerakli fayllar (~0.3 GB, oldin butun repo + node_modules 1.3 GB). Migratsiya va bootstrap uchun `@adone/db` alohida
# (/app/db, `pnpm deploy`) — konteyner ichidan ishlaydi (docs/DEPLOY.md §5).
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat && corepack enable
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
# Coolify build-time env'larni build-arg sifatida beradi; proxy (edge) ROOT_DOMAIN'ni build paytida oladi.
ARG ROOT_DOMAIN
ARG PUBLIC_URL
# Landing (/sayt) statik yig'iladi — aloqa havolalari build paytida olinadi (bo'sh bo'lsa ko'rinmaydi)
ARG PLATFORM_BOT_USERNAME
ARG NEXT_PUBLIC_SUPPORT_TELEGRAM
ARG NEXT_PUBLIC_SUPPORT_PHONE
ARG NEXT_PUBLIC_INSTAGRAM
ARG NEXT_PUBLIC_YOUTUBE
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @adone/web build \
 && pnpm --filter @adone/db deploy --prod --legacy /out/db

FROM node:24-alpine AS run
WORKDIR /app
# tini — PID 1: signallarni Node'ga uzatadi, zombi jarayon qoldirmaydi. SIGTERM'ni ilovaning o'zi ushlaydi (instrumentation.ts:
# so'rovlar tugashini kutib, baza pool'ini yopadi) — NEXT_MANUAL_SIG_HANDLE.
RUN apk add --no-cache tini libc6-compat
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 MEDIA_DIR=/app/media-data NEXT_MANUAL_SIG_HANDLE=true
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /out/db ./db
RUN mkdir -p /app/media-data
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
