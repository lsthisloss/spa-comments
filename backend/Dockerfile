# Multi-stage build для разных окружений

# Development stage
FROM node:20-alpine AS development
WORKDIR /app

ENV NODE_ENV=development

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with memory optimization
RUN npm ci --no-audit --progress=false && npm cache clean --force

# Copy source code
COPY . .

EXPOSE 3001

# Development command
CMD ["npm", "run", "dev"]

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Higher memory limit for building
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies for build
RUN npm ci --no-audit --progress=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Production memory optimization
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-audit --progress=false && npm cache clean --force

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Create uploads directory structure
RUN mkdir -p uploads/avatars uploads/images uploads/files

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership and switch user
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Production command
CMD ["node", "dist/main"]