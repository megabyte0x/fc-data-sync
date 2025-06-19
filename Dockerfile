# Use the official Node.js 18 image based on Alpine Linux, which is lightweight and suitable for production
FROM node:18-alpine

# Set the working directory inside the container to /app
WORKDIR /app

# Copy package.json and package-lock.json (if present) to the working directory
COPY package*.json ./

# Install only production dependencies using npm ci for a clean and reproducible install
RUN npm ci --only=production

# Copy the rest of the application code into the container
COPY . .

# Build the TypeScript code (transpile to JavaScript) using the build script defined in package.json
RUN npm run build

# Expose port 3000 so the application can be accessed from outside the container
EXPOSE 3000

# Set the default command to start the application using npm
CMD ["npm", "start"]