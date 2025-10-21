# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Adjust for your framework:
# React/Vite: 
RUN npm run build

# Serve stage
FROM nginx:1.27-alpine
# remove default config & add our own simple one that serves /index.html for SPA routes
RUN rm /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Basic SPA config
RUN printf 'server { \
  listen 80; \
  server_name _; \
  root /usr/share/nginx/html; \
  location / { try_files $uri /index.html; } \
  sendfile on; \
}\n' > /etc/nginx/conf.d/app.conf
EXPOSE 80
