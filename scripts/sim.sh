#!/bin/bash
set -e

echo "→ Starting vite dev server..."
npx vite &
VITE_PID=$!

trap "kill $VITE_PID $SIM_PID 2>/dev/null; exit" INT TERM EXIT

# Wait for server
for i in {1..20}; do
  if curl -sf http://localhost:5173 >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "→ Starting EvenHub Simulator..."
npx @evenrealities/evenhub-simulator http://localhost:5173 &
SIM_PID=$!

echo "→ Simulator launched. Ctrl+C to stop."
wait
