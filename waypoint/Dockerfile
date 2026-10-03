# Waypoint app image (Next.js standalone). Build: docker build -t waypoint .
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && cp -r node_modules /prod_modules && npm ci --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# migrate/seed scripts and schemas, run with: docker compose run --rm app1 node --experimental-strip-types scripts/migrate.ts
COPY --from=build --chown=app:app /app/db ./db
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/lib ./lib
COPY --from=deps --chown=app:app /prod_modules ./node_modules
USER app
EXPOSE 3000
CMD ["node", "server.js"]
