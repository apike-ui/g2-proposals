#!/bin/bash
# G2 Proposal Builder — startup script
# Run this to start the app. It will be available at http://localhost:5001/proposals
# and via a public Cloudflare tunnel URL printed below.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Kill any existing instances
pkill -f "proposals-server.py" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 1

# Install python-pptx if needed
python3 -c "import pptx" 2>/dev/null || pip3 install python-pptx -q

# Start Flask server
nohup python3 "$DIR/proposals-server.py" > "$DIR/proposals-server.log" 2>&1 &
FLASK_PID=$!
echo "Flask server starting (PID $FLASK_PID)..."
sleep 2

# Verify Flask is up
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/proposals)
if [ "$HTTP" != "200" ]; then
    echo "ERROR: Flask server failed to start. Check $DIR/proposals-server.log"
    exit 1
fi
echo "✓ Flask server running at http://localhost:5001/proposals"

# Start Cloudflare tunnel
if command -v cloudflared &>/dev/null; then
    nohup cloudflared tunnel --url http://localhost:5001 --no-autoupdate > "$DIR/cf-tunnel.log" 2>&1 &
    echo "Cloudflare tunnel starting..."
    sleep 5
    TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$DIR/cf-tunnel.log" | head -1)
    if [ -n "$TUNNEL_URL" ]; then
        echo "✓ Public URL: $TUNNEL_URL/proposals"
        echo "$TUNNEL_URL" > "$DIR/current-tunnel-url.txt"
    else
        echo "Tunnel starting (check $DIR/cf-tunnel.log for URL in ~10 seconds)"
    fi
else
    echo "cloudflared not found — install with: brew install cloudflared"
    echo "App available locally at http://localhost:5001/proposals"
fi

echo ""
echo "G2 Proposal Builder is running."
