#!/usr/bin/env bash
# Open two Cloudflare quick tunnels and start both servers wired together.
# When this script exits (Ctrl-C), the tunnels close and the public links die.
#
# Prereqs (one-time):
#   sudo apt-get install -y cloudflared
# OR:
#   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
#   sudo install cloudflared-linux-amd64 /usr/local/bin/cloudflared
#
# Then:  bash scripts/share-with-friend.sh

set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"

command -v cloudflared >/dev/null || {
  echo "cloudflared not installed. See top of this script."
  exit 1
}

LOG=/tmp/meow-share
mkdir -p "$LOG"
: > "$LOG/back-tunnel.log"
: > "$LOG/front-tunnel.log"

trap 'echo; echo "Shutting down…"; kill $(jobs -p) 2>/dev/null; exit 0' INT TERM

# 1. Backend dev server (port 3000)
echo "[1/4] starting backend on :3000…"
( cd backend && npm run start:dev ) >"$LOG/back.log" 2>&1 &

# 2. Backend tunnel — wait for it to print the trycloudflare URL, then export it
echo "[2/4] opening backend tunnel…"
cloudflared tunnel --no-autoupdate --url http://localhost:3000 >"$LOG/back-tunnel.log" 2>&1 &
BACK_URL=""
for i in $(seq 1 30); do
  BACK_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG/back-tunnel.log" | head -1)
  [ -n "$BACK_URL" ] && break
  sleep 1
done
[ -n "$BACK_URL" ] || { echo "backend tunnel failed; see $LOG/back-tunnel.log"; exit 1; }
echo "       backend public URL: $BACK_URL"

# 3. Frontend tunnel — same drill on port 3001
echo "[3/4] opening frontend tunnel…"
cloudflared tunnel --no-autoupdate --url http://localhost:3001 >"$LOG/front-tunnel.log" 2>&1 &
FRONT_URL=""
for i in $(seq 1 30); do
  FRONT_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG/front-tunnel.log" | head -1)
  [ -n "$FRONT_URL" ] && break
  sleep 1
done
[ -n "$FRONT_URL" ] || { echo "frontend tunnel failed; see $LOG/front-tunnel.log"; exit 1; }
echo "       frontend public URL: $FRONT_URL"

# 4. Frontend dev server — pointed at the backend tunnel via NEXT_PUBLIC_API_URL.
#    Also tells the backend to accept the frontend tunnel as a CORS origin.
echo "[4/4] starting frontend on :3001 (wired to $BACK_URL)…"
NEXT_PUBLIC_API_URL="$BACK_URL" npm run dev >"$LOG/front.log" 2>&1 &

# Push the FRONTEND_ORIGIN into the running backend so CORS accepts the tunnel.
# Easiest path: write it into backend/.env and let nodemon restart pick it up.
if [ -f backend/.env ]; then
  if grep -q "^FRONTEND_ORIGIN=" backend/.env; then
    sed -i "s|^FRONTEND_ORIGIN=.*|FRONTEND_ORIGIN=\"$FRONT_URL\"|" backend/.env
  else
    echo "FRONTEND_ORIGIN=\"$FRONT_URL\"" >> backend/.env
  fi
fi

cat <<EOF

════════════════════════════════════════════════════════════════
  📱 Send this link to your friend (open on her phone):

     $FRONT_URL

  Backend  : $BACK_URL
  Logs     : $LOG/
  Stop     : Ctrl-C in this terminal (closes tunnels too)
════════════════════════════════════════════════════════════════

Tail logs in another terminal:
  tail -f $LOG/front.log
  tail -f $LOG/back.log

EOF

# Stay alive while children run
wait
