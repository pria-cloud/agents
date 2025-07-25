# Use E2B base image for code interpreter
FROM e2bdev/code-interpreter:latest

# Install Node.js 20.x (required for Next.js 15)
RUN apt-get update && \
    apt-get install -y ca-certificates curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install additional system dependencies
RUN apt-get install -y \
    git \
    vim \
    nano \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Create and set the working directory
WORKDIR /code

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies with legacy peer deps for React 19 compatibility
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Create necessary directories
RUN mkdir -p /code/app /code/components /code/lib /code/public /code/components/ui

# Make startup script executable
RUN chmod +x /code/start-sandbox.sh

# Set environment variables for development
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Set Supabase environment variables
ENV NEXT_PUBLIC_SUPABASE_URL="https://ktodzuolttfqrkozlsae.supabase.co"
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0b2R6dW9sdHRmcXJrb3psc2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MjI0MjIsImV4cCI6MjA2NTQ5ODQyMn0.yCT4s4Uq7ufxtwHEhF9_XV32jFX54INAz-KP6v3IDBY"

# Expose the port the app runs on
EXPOSE 3000

# Set the command to start the development server for hot reloading
CMD ["./start-sandbox.sh"]