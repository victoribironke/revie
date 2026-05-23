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

# Build TypeScript to JavaScript
RUN bun build src/index.ts --outdir ./dist --target=bun

# Cloud Run injects PORT automatically (defaults to 8080)
EXPOSE 8080

# Run the compiled output
CMD ["bun", "run", "dist/index.js"]
