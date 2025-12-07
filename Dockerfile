FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages ./packages

# Install dependencies
RUN npm install && \
    cd packages/mcp-servers/google-maps && npm install && \
    cd ../weather && npm install && \
    cd ../travel-agent && npm install

# Copy source
COPY . .

# Expose ports
EXPOSE 3001 3003 3004 3005

# Start all services
CMD ["node", "start-all-services.js"]
