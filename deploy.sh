#!/bin/bash
# =============================================================
# SplitTheBill — Deployment Script
# Run from your LOCAL WINDOWS machine (Git Bash / WSL)
# Usage: bash deploy/deploy.sh
# =============================================================

set -e

# ─── CONFIG — Edit these values ──────────────────────────────
EC2_USER="ubuntu"
EC2_HOST="13.210.115.187"
EC2_KEY="/c/Users/Nishath A/Downloads/splitthebill-key.pem"
# ──────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "============================================================"
echo "  SplitTheBill — Deploying to $EC2_HOST"
echo "============================================================"

# ─── Step 1: Build Frontend ───────────────────────────────────
echo ""
echo "[1/4] Building frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build
echo "  ✓ Frontend built at frontend/dist/"

# ─── Step 2: Build Backend ────────────────────────────────────
echo ""
echo "[2/4] Building backend..."
cd "$BACKEND_DIR"
mvn clean package -DskipTests -q
JAR_FILE=$(ls target/*.jar | grep -v 'original' | head -1)
echo "  ✓ Backend built: $JAR_FILE"

# ─── Step 3: Upload to EC2 ────────────────────────────────────
echo ""
echo "[3/4] Uploading files to EC2..."

# Upload Spring Boot JAR
echo "  → Uploading backend JAR..."
scp -i "$EC2_KEY" -o StrictHostKeyChecking=no \
    "$JAR_FILE" \
    "$EC2_USER@$EC2_HOST:/opt/splitthebill/app.jar"

# Upload frontend build (rsync is faster for incremental updates)
echo "  → Uploading frontend static files..."
ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
    "sudo rm -rf /var/www/splitthebill/* && sudo mkdir -p /var/www/splitthebill && sudo chown -R ubuntu:ubuntu /var/www/splitthebill"

scp -i "$EC2_KEY" -o StrictHostKeyChecking=no -r \
    "$FRONTEND_DIR/dist/"* \
    "$EC2_USER@$EC2_HOST:/var/www/splitthebill/"

echo "  ✓ Files uploaded"

# ─── Step 4: Restart Backend Service ─────────────────────────
echo ""
echo "[4/4] Restarting backend service..."
ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
    "sudo systemctl restart splitthebill && sleep 3 && sudo systemctl status splitthebill --no-pager"

echo ""
echo "============================================================"
echo "  Deployment Complete!"
echo ""
echo "  Frontend : http://$EC2_HOST"
echo "  API      : http://$EC2_HOST/api"
echo "  Logs     : ssh -i $EC2_KEY $EC2_USER@$EC2_HOST 'tail -f /var/log/splitthebill/app.log'"
echo "============================================================"
