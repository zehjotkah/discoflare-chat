#!/bin/bash

# Deployment script for DiscoFlare Chat
# This script builds and deploys both workers

set -e  # Exit on error

echo "========================================="
echo "DiscoFlare Chat Deployment"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}Error: wrangler CLI not found${NC}"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
echo -e "${BLUE}Checking Wrangler authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Cloudflare${NC}"
    echo "Please run: wrangler login"
    exit 1
fi
echo -e "${GREEN}✓ Authenticated${NC}"
echo ""

# Build widget
echo -e "${BLUE}Building chat widget...${NC}"
bash scripts/build-widget.sh
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Failed to build widget${NC}"
    exit 1
fi
echo ""

# Deploy main worker
echo -e "${BLUE}Deploying main worker...${NC}"
cd workers/main-worker

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Deploy
npm run deploy
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Failed to deploy main worker${NC}"
    exit 1
fi

MAIN_WORKER_URL=$(wrangler deployments list --name discoflare-chat-main 2>/dev/null | grep -o 'https://[^ ]*' | head -1)
echo -e "${GREEN}✓ Main worker deployed${NC}"
if [ ! -z "$MAIN_WORKER_URL" ]; then
    echo -e "  URL: ${MAIN_WORKER_URL}"
fi

cd ../..
echo ""

# Deploy bot relay
echo -e "${BLUE}Deploying bot relay worker...${NC}"
cd workers/bot-relay

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Deploy
npm run deploy
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Failed to deploy bot relay worker${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Bot relay worker deployed${NC}"
cd ../..
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Set secrets for main worker:"
echo "   cd workers/main-worker"
echo "   wrangler secret put DISCORD_BOT_TOKEN"
echo "   wrangler secret put DISCORD_SUPPORT_CHANNEL_ID"
echo "   wrangler secret put TURNSTILE_SECRET_KEY"
echo "   wrangler secret put BOT_RELAY_SECRET"
echo "   wrangler secret put ALLOWED_ORIGINS"
echo ""
echo "2. Set secrets for bot relay:"
echo "   cd workers/bot-relay"
echo "   wrangler secret put DISCORD_BOT_TOKEN"
echo "   wrangler secret put BOT_RELAY_SECRET"
echo "   wrangler secret put MAIN_WORKER_URL"
echo ""
echo "3. Update your website with the widget:"
if [ ! -z "$MAIN_WORKER_URL" ]; then
    echo "   workerUrl: '${MAIN_WORKER_URL}'"
fi
echo ""
echo "For detailed setup instructions, see:"
echo "  - plans/deployment-guide.md"
echo "  - README.md"
echo ""
