# Use the official Node.js 22 image as a base
FROM node:22-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code to the working directory
COPY . .

# Build the Next.js application for production
RUN npm run build

# Expose the port the app runs on
EXPOSE 9002

# The command to run the application
CMD ["npm", "run", "start"]
