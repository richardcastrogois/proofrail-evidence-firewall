FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PROOFRAIL_API_URL=http://backend:3333

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY worker/package.json worker/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json

RUN npm ci --include=dev && npm cache clean --force

COPY . .

RUN npm run typecheck --workspace @rational/mcp \
  && groupadd --system proofrail \
  && useradd --system --gid proofrail --home-dir /app proofrail \
  && mkdir -p /app/data \
  && chown -R proofrail:proofrail /app/data

USER proofrail

CMD ["npm", "run", "dev", "--workspace", "@rational/mcp"]
