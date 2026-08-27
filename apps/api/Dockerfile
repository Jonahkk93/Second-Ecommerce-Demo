FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci
COPY apps/api ./apps/api
RUN npm run api:build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/drizzle ./apps/api/drizzle
COPY apps/api/scripts/migrate-production.mjs ./apps/api/scripts/migrate-production.mjs
USER node
EXPOSE 3000
CMD ["npm", "--workspace", "apps/api", "run", "start"]
