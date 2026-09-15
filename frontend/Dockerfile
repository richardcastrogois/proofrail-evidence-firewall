FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY worker/package.json worker/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json

RUN npm ci

COPY . .

ARG VITE_API_URL=""
ARG VITE_PROOFRAIL_API_MODE=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PROOFRAIL_API_MODE=$VITE_PROOFRAIL_API_MODE

RUN npm run build --workspace @rational/web

FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

RUN sed -i 's|/run/nginx.pid|/tmp/nginx.pid|' /etc/nginx/nginx.conf \
  && chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx

EXPOSE 8080

USER nginx

CMD ["nginx", "-g", "daemon off;"]
