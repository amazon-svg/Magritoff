FROM node:22-bookworm-slim AS app
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY src ./src
COPY public ./public
COPY config ./config
COPY openapi ./openapi
COPY infra/postgres ./infra/postgres
COPY infra/pim ./infra/pim
COPY scripts/db ./scripts/db
COPY scripts/infra ./scripts/infra
COPY index.html vite.config.ts tsconfig*.json ./
RUN pnpm build
USER node
CMD ["node", "--import", "tsx", "src/server/node/main.ts"]

FROM nginx:stable-bookworm AS web
COPY infra/preprod/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=app /app/dist /usr/share/nginx/html
