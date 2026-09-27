#!/bin/bash

# JestBest Development Startup Script
# This script starts both backend and frontend in development mode

echo "🚀 Starting JestBest Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo -e "${BLUE}Checking Docker services...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Start Docker services (PostgreSQL & Redis)
echo -e "${BLUE}Starting PostgreSQL and Redis...${NC}"
docker compose up -d postgres redis

# Wait for services to be ready
echo -e "${BLUE}Waiting for database to be ready...${NC}"
sleep 3

# Run database migrations
echo -e "${BLUE}Running database migrations...${NC}"
npm run prisma:migrate

# Check if backend dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    npm install
fi

# Check if frontend dependencies are installed
if [ ! -d "web/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd web && npm install && cd ..
fi

echo ""
echo -e "${GREEN}✅ All services are ready!${NC}"
echo ""
echo -e "${BLUE}Starting development servers...${NC}"
echo ""
echo -e "${GREEN}Backend API:${NC} http://localhost:4000"
echo -e "${GREEN}Frontend:${NC}    http://localhost:5173"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping services...${NC}"
    kill $(jobs -p) 2>/dev/null
    echo -e "${GREEN}✅ Stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend in background
npm run dev &

# Wait a bit for backend to start
sleep 2

# Start frontend
cd web && npm run dev &

# Wait for all background processes
wait
