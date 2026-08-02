# syntax=docker/dockerfile:1

# Build stage: real Node.js is required because vue-tsc's TypeScript patch
# does not work under the Bun runtime (bun acts as `node` in oven/bun images,
# which makes every .vue import unresolvable). Bun is still used for installs.
FROM node:26-bookworm-slim AS build
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM nginx:1-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
