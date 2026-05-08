FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/ ./dist/

RUN mkdir -p /app/data
VOLUME ["/app/data"]

CMD ["node", "--env-file=.env", "dist/index.js"]
