#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_DIR="$ROOT_DIR/apps/site"
REMOTE_HOST="${REMOTE_HOST:-irb}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/irb-whatsapp-ai}"
REMOTE_SITE_DIR="$REMOTE_ROOT/apps/site"

echo "[deploy-site] building static export locally"
cd "$ROOT_DIR"
pnpm --filter @irb/site build

echo "[deploy-site] syncing apps/site to $REMOTE_HOST:$REMOTE_SITE_DIR"
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude out \
  --exclude tsconfig.tsbuildinfo \
  "$SITE_DIR/" "$REMOTE_HOST:$REMOTE_SITE_DIR/"

echo "[deploy-site] building on server"
ssh "$REMOTE_HOST" "cd '$REMOTE_ROOT' && pnpm --filter @irb/site build"

echo "[deploy-site] validating nginx on server"
ssh "$REMOTE_HOST" "nginx -t"

echo "[deploy-site] done"
