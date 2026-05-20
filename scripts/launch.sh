#!/bin/bash
set -e

SESSION="g2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Dependency checks
if ! command -v tmux &>/dev/null; then
  echo "✗ tmux not found — install: brew install tmux"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "✗ node not found — install from nodejs.org"
  exit 1
fi

# Idempotent: attach if session already exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "→ Session '$SESSION' exists — attaching to work window"
  exec tmux attach-session -t "${SESSION}:work"
fi

echo "→ Creating tmux session '$SESSION'..."

# Create detached session — window 0 = server
tmux new-session -d -s "$SESSION" -n server

# Server window: top pane runs Vite, bottom pane (5 rows) runs bridge
tmux send-keys -t "${SESSION}:server" "cd '${PROJECT_DIR}' && bash scripts/dev.sh" Enter
tmux split-window -t "${SESSION}:server" -v -l 5
tmux send-keys -t "${SESSION}:server.1" "cd '${PROJECT_DIR}' && node scripts/bridge.js" Enter

# Work window: interactive shell locked to G2 grid (50 cols x 10 rows)
tmux new-window -t "${SESSION}" -n work "env BASH_SILENCE_DEPRECATION_WARNING=1 PS1='$ ' /bin/bash --norc --noprofile"
tmux set-window-option -t "${SESSION}:work" window-size manual
tmux resize-window -t "${SESSION}:work" -x 50 -y 10

echo "→ Attaching to work window (50x10 — G2 grid)"
exec tmux attach-session -t "${SESSION}:work"
