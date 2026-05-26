#!/bin/bash

# Name of the tmux session
SESSION="dishcision"

# Check if session exists and kill it
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Killing tmux session '$SESSION'..."
  tmux kill-session -t "$SESSION"
  echo "Session '$SESSION' killed successfully."
else
  echo "Session '$SESSION' is not running."
fi
