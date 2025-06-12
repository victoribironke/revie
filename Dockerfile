FROM oven/bun:1.1.0

WORKDIR /app

COPY . .

RUN bun install

RUN bun run tsc

ENV NODE_ENV=production

EXPOSE 8080

CMD ["bun", "run", "src/index.ts"]
