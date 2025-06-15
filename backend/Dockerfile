# Multi-stage build для разных окружений

# Development stage
FROM node:20-alpine AS development
WORKDIR /app

ENV NODE_ENV=development

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (including dev) for development
RUN npm install --no-audit --progress=false && npm cache clean --force

# Copy source code
COPY . .

EXPOSE 3001

# Development command
CMD ["npm", "run", "start:dev"]

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Higher memory limit for building
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install ALL dependencies for build (using npm install instead of npm ci)
RUN npm install --no-audit --progress=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Debug: показать что создалось после сборки
RUN echo "=== Files after build ===" && ls -la
RUN echo "=== Dist directory ===" && ls -la dist/ || echo "No dist directory"

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

# Install ONLY production dependencies (using npm install instead of npm ci)
RUN npm install --omit=dev --no-audit --progress=false && npm cache clean --force

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Debug: проверить что скопировалось
RUN echo "=== Production files ===" && ls -la
RUN echo "=== Production dist ===" && ls -la dist/ || echo "No dist in production"

# Create uploads directory structure
RUN mkdir -p uploads/avatars uploads/images uploads/files

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership and switch user
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3001

RUN mkdir -p /app/uploads/avatars
RUN chmod 777 /app/uploads /app/uploads/avatars

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Production command
CMD ["node", "dist/main.js"]