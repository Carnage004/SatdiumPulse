FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code (will respect .dockerignore)
COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
