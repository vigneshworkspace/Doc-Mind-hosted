FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Cache-bust the source copy so app/ edits are picked up (BuildKit otherwise reuses
# a stale COPY layer). Pass --build-arg CACHEBUST=$(date +%s).
ARG CACHEBUST=0
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
