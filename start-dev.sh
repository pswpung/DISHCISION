#!/bin/bash

# Name of the tmux session
SESSION="dishcision"

# Check if session already exists, attach if it does
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already exists. Attaching..."
  tmux attach-session -t "$SESSION"
  exit 0
fi

# Create new session, starting with the first window 'deploy' (prevent immediate attach)
tmux new-session -d -s "$SESSION" -n "deploy"

# Window 1: deploy
# Run docker compose up
tmux send-keys -t "$SESSION:deploy" "cd deploy && docker compose up" C-m

# Window 2: services
# Create the window
tmux new-window -t "$SESSION" -n "services"
# Run frontend dev in the active (first) pane
tmux send-keys -t "$SESSION:services" "cd frontend && npm run dev" C-m
# Split pane horizontally (side-by-side) and select the new pane
tmux split-window -h -t "$SESSION:services"
# Run backend uv dev in the new active pane
tmux send-keys -t "$SESSION:services" "cd backend && uv run main.py" C-m

# Window 3: tunnels
# Create the window
tmux new-window -t "$SESSION" -n "tunnels"
# Run ngrok in the active (first) pane
tmux send-keys -t "$SESSION:tunnels" "./start-ngrok.sh" C-m
# Split pane horizontally (side-by-side) and select the new pane
tmux split-window -h -t "$SESSION:tunnels"
# Run cloudflared in the new active pane (using start-cloudflared.sh)
tmux send-keys -t "$SESSION:tunnels" "./start-cloudflared.sh" C-m

# Select the first window 'deploy' to show on attach
tmux select-window -t "$SESSION:deploy"

# Attach to the session
tmux attach-session -t "$SESSION"
