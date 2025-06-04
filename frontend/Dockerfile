# Multi-stage build для оптимизации

# Development stage
FROM node:18-alpine AS development
WORKDIR /app

# Memory optimization
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NODE_ENV=development

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --no-audit --progress=false && npm cache clean --force

# Copy source code
COPY . .

EXPOSE 3000

# Development command with host binding
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# Higher memory for build
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --no-audit --progress=false && npm cache clean --force

# Copy source code
COPY . .

# Build for production
RUN npm run build

# Production stage (nginx)
FROM nginx:alpine AS production

# Copy built app
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]