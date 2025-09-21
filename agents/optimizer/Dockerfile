# Optimizer Agent Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install --legacy-peer-deps --force

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Keep all dependencies for now to avoid conflicts
# RUN npm prune --production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S optimizer -u 1001

# Change ownership
RUN chown -R optimizer:nodejs /app
USER optimizer

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["npm", "start"]