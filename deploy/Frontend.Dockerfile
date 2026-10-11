FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY example ./example
RUN npm run build:example

FROM caddy:2-alpine
COPY --from=build /src/dist-example /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
