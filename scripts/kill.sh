#!/bin/bash
SESSION="g2"
if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux kill-session -t "$SESSION"
  echo "→ Session '$SESSION' stopped"
else
  echo "→ No session '$SESSION' running"
fi
