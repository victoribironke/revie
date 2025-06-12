# Use official Bun image
FROM oven/bun:1.1.0

WORKDIR /app

COPY . .

RUN bun install
RUN bun run tsc

ENV NODE_ENV=production

# Cloud Run expects port 8080 by default
EXPOSE 8080

CMD ["bun", "run", "src/index.ts"]
