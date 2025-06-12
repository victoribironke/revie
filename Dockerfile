# Use Bun's official image
FROM oven/bun:1.1.0

# Create app directory
WORKDIR /app

# Copy files
COPY . .

# Install dependencies
RUN bun install

# Build TypeScript
RUN bun run tsc

# Expose the port Bun will listen on
EXPOSE 3000

# Start the server
CMD ["bun", "run", "src/index.ts"]
