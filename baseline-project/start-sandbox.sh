#!/bin/bash

# E2B Sandbox startup script for Next.js 15 with Supabase
echo "🚀 Starting E2B Sandbox with Next.js 15, Supabase, and Tailwind 4..."

# Set proper permissions
chmod +x /code/start-sandbox.sh

# Create .env.local if it doesn't exist
if [ ! -f /code/.env.local ]; then
    echo "📝 Creating .env.local file..."
    cp /code/.env.local.example /code/.env.local 2>/dev/null || echo "# Environment variables" > /code/.env.local
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d /code/node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Install all shadcn components if components/ui directory doesn't exist
if [ ! -d /code/components/ui ]; then
    echo "🎨 Installing all shadcn/ui components..."
    npx shadcn@latest add --all --yes
fi

# Start the development server
echo "🎯 Starting Next.js development server..."
npm run dev