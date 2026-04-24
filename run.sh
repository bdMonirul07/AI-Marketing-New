#!/bin/bash

# Define ports
BACKEND_PORT=5286
FRONTEND_PORT=5173

# Function to kill process on a port
kill_port() {
    local port=$1
    local name=$2
    echo "Checking for running $name on port $port..."
    local pids
    pids=$(lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "Killing existing $name process(es) on port $port: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null
        sleep 0.5
    else
        echo "No existing $name process found on port $port."
    fi
}

# Kill existing processes
kill_port $BACKEND_PORT "Backend"
kill_port $FRONTEND_PORT "Frontend"

# Start Backend
echo "Starting Backend..."
cd backend || exit
# Run in background, redirect output to a log file or keep in terminal? 
# Usually for a 'run all' script, seeing mixed output can be messy. 
# But for dev, we often want to see it. 
# Let's run it in the background but allow output to stdout prefixed or just let it mix.
dotnet run --urls "http://localhost:$BACKEND_PORT" &
BACKEND_PID=$!
echo "Backend started with PID $BACKEND_PID"
cd ..

# Start Frontend
echo "Starting Frontend..."
cd frontend || exit
npm run dev -- --port $FRONTEND_PORT &
FRONTEND_PID=$!
echo "Frontend started with PID $FRONTEND_PID"
cd ..

# Trap Ctrl+C to kill both processes
cleanup() {
    echo ""
    echo "Stopping applications..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Stopped."
    exit
}

trap cleanup SIGINT SIGTERM

echo "------------------------------------------------"
echo "Backend accessible at http://localhost:$BACKEND_PORT"
echo "Frontend accessible at http://localhost:$FRONTEND_PORT"
echo "Press Ctrl+C to stop."
echo "------------------------------------------------"

# Wait for processes
wait
