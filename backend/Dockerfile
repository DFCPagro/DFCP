# 1) Install deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# 2) Build TS → JS
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Make sure you have "build": "tsc" (or your build) in package.json
RUN npm run build

# 3) Runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Copy only what we need at runtime
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# If you serve static/swagger YAML, also copy those folders:
COPY --from=build /app/src/docs ./src/docs

# Expose the app port (keep in sync with PORT env)
EXPOSE 3000

# Start compiled server (server.ts → dist/server.js)
CMD ["node","dist/server.js"]
