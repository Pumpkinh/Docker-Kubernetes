# =========================
# Stage 1: build frontend
# =========================
FROM node:20-alpine AS build

WORKDIR /app

RUN npm create vite@latest . -- --template vanilla
RUN npm install three


ARG MAIN_FILE=main1.js
COPY ${MAIN_FILE} /app/src/main.js
COPY index.html /app/index.html

RUN npm run build


# =========================
# Stage 2: nginx non-root
# =========================
FROM nginx:alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp \
    && chown -R appuser:appgroup /usr/share/nginx/html /etc/nginx /tmp

USER appuser

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

