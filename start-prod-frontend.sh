#!/bin/bash

# Build and start the frontend in production mode.
# Use this instead of 'npm run dev' when exposing via tunnel.
# Production builds use stable content-hash chunk names — no more 404s on mobile.

set -e

# Ensure node/npm from NVM is on PATH (tmux doesn't load .zshrc by default)
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"

echo "🏗️  Building frontend for production..."
cd frontend
npm run build

echo "🚀 Starting production server on port 3001..."
npm run start -- -p 3001
