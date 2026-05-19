#!/bin/bash
set -e

# Resolve LAN IP (macOS en0 first, fallback to any non-loopback)
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$LAN_IP" ]; then
  LAN_IP="localhost"
fi

DEV_URL="http://$LAN_IP:5173"
echo "→ LAN: $DEV_URL"

# Start vite in background, capture its PID
npx vite &
VITE_PID=$!

# Kill vite when this script exits
trap "kill $VITE_PID 2>/dev/null; exit" INT TERM EXIT

# Wait for server to be ready
echo "→ Waiting for server..."
for i in {1..20}; do
  if curl -sf http://localhost:5173 >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo ""
echo "→ Scan to sideload on device:"
npx evenhub qr --url "$DEV_URL" || echo "  (QR failed — load manually: $DEV_URL)"
echo ""
echo "→ Running. Ctrl+C to stop."
wait $VITE_PID
