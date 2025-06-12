# Dockerfile

# Use Bun's official slim Alpine image
FROM oven/bun:1.1.20-alpine as base

# Set working directory
WORKDIR /app

# Copy package.json and bun.lockb to install dependencies
COPY package.json bun.lockb ./

# Install dependencies. Use --production to skip dev dependencies
RUN bun install --production

# Copy the rest of your application code
COPY . .

# Build your TypeScript code (if using TypeScript)
# This will output JavaScript files to a 'dist' directory
RUN bun build src/index.ts --outdir ./dist --target=bun

# Expose the port your Bun server will listen on
# Ensure this matches the PORT environment variable in your Bun code (e.g., 10000)
EXPOSE 10000

# Command to run your Bun application
# Use 'bun run' to execute the transpiled JavaScript
CMD ["bun", "run", "dist/index.js"]

# For development environment:
# If you want to keep your development server running in a container,
# you'd use something like:
# CMD ["bun", "run", "src/index.ts"]
# But for Cloud Run, a build step is usually better.