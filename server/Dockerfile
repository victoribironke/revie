# Use Bun's official Alpine image
FROM oven/bun:alpine

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package.json bun.lock ./
RUN bun install --production

# Copy the rest of the application code
COPY . .

# Set the environment variable for production
ENV NODE_ENV=production

# Cloud Run injects PORT=8080 automatically
EXPOSE 8080

# Run TypeScript directly — Bun handles it natively, no build step needed
CMD ["bun", "run", "src/index.ts"]
