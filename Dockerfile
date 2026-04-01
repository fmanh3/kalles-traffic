FROM node:22-alpine

WORKDIR /app

# Install dependencies for the specific service
WORKDIR /app/kalles-traffic
COPY kalles-traffic/package*.json ./
RUN npm install --legacy-peer-deps

# Copy the entire monorepo so cross-repo relative imports work
WORKDIR /app
COPY kalles-traffic ./kalles-traffic
COPY kalles-finance ./kalles-finance

WORKDIR /app/kalles-traffic
CMD ["npm", "start"]
