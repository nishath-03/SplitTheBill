#!/bin/bash
# =============================================================
# SplitTheBill — EC2 Server Setup Script
# Run ONCE on a fresh Ubuntu 22.04 EC2 instance
# Usage: bash setup-server.sh
# =============================================================

set -e
echo "============================================================"
echo "  SplitTheBill — Server Setup Starting"
echo "============================================================"

# ─── Update system ────────────────────────────────────────────
echo "[1/9] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ─── Install Java 21 ──────────────────────────────────────────
echo "[2/9] Installing Java 21..."
sudo apt-get install -y wget apt-transport-https gnupg
wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | sudo gpg --dearmor -o /usr/share/keyrings/adoptium.gpg
echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/adoptium.list
sudo apt-get update -y
sudo apt-get install -y temurin-21-jdk
java -version

# ─── Install Nginx ────────────────────────────────────────────
echo "[3/9] Installing Nginx..."
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# ─── Install Redis ────────────────────────────────────────────
echo "[4/9] Installing Redis..."
sudo apt-get install -y redis-server
sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
sudo sed -i 's/^# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
sudo sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
sudo systemctl enable redis-server
sudo systemctl restart redis-server
echo "Redis status:"
redis-cli ping

# ─── Install Node.js 20 (for building frontend) ───────────────
echo "[5/9] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v

# ─── Create app user & directories ───────────────────────────
echo "[6/9] Creating app directories..."
sudo mkdir -p /opt/splitthebill
sudo mkdir -p /var/log/splitthebill
sudo mkdir -p /var/www/splitthebill
sudo chown -R ubuntu:ubuntu /opt/splitthebill
sudo chown -R ubuntu:ubuntu /var/log/splitthebill
sudo chown -R ubuntu:ubuntu /var/www/splitthebill

# ─── Configure Nginx ──────────────────────────────────────────
echo "[7/9] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/splitthebill > /dev/null << 'NGINX_EOF'
server {
    listen 80;
    server_name _;  # Replace with your domain if you have one

    # Increase buffer sizes for WebSocket
    proxy_buffers 8 32k;
    proxy_buffer_size 64k;

    # ── Frontend static files ────────────────────────────────
    root /var/www/splitthebill;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── Backend API ──────────────────────────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:8085/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
        proxy_connect_timeout 90;
    }

    # ── WebSocket (STOMP over SockJS) ────────────────────────
    location /ws/ {
        proxy_pass http://127.0.0.1:8085/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }

    # ── Gzip compression ────────────────────────────────────
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
NGINX_EOF

sudo ln -sf /etc/nginx/sites-available/splitthebill /etc/nginx/sites-enabled/splitthebill
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# ─── Create systemd service for Spring Boot ───────────────────
echo "[8/9] Creating systemd service..."
sudo tee /etc/systemd/system/splitthebill.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=SplitTheBill Spring Boot Application
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/splitthebill
EnvironmentFile=/opt/splitthebill/.env
ExecStart=/usr/bin/java -jar -Dspring.profiles.active=prod /opt/splitthebill/app.jar
SuccessExitStatus=143
TimeoutStopSec=10
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/splitthebill/app.log
StandardError=append:/var/log/splitthebill/error.log

[Install]
WantedBy=multi-user.target
SERVICE_EOF

sudo systemctl daemon-reload
sudo systemctl enable splitthebill

# ─── Configure UFW firewall ───────────────────────────────────
echo "[9/9] Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo ""
echo "============================================================"
echo "  Setup Complete!"
echo ""
echo "  Next steps:"
echo "  1. Create /opt/splitthebill/.env with your credentials"
echo "  2. Run deploy.sh from your local machine to push the app"
echo "  3. Start the service: sudo systemctl start splitthebill"
echo "============================================================"
