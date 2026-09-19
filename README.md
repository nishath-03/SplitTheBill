# 🍽️ SplitTheBill

A real-time bill-splitting web app for groups — scan receipts, assign items, and settle up instantly.

**Stack:** React (Vite) · Spring Boot 3 (Java 21) · H2 Database · Redis · WebSocket (STOMP) · Nginx · AWS EC2

---

## 📁 Project Structure

```
SplitTheBill/
├── backend/                  # Spring Boot REST API + WebSocket
│   ├── src/main/java/        # Java source (controllers, services, entities)
│   ├── src/main/resources/   # application.properties (dev + prod)
│   ├── Dockerfile
│   └── pom.xml
├── frontend/                 # React + Vite SPA
│   ├── src/                  # Components, pages, services, context
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── deploy/
│   ├── setup-server.sh       # Run ONCE on a fresh EC2 instance
│   ├── deploy.sh             # Local → EC2 deploy script
│   └── .env.template         # Template for /opt/splitthebill/.env on EC2
└── .github/workflows/
    └── deploy.yml            # CI/CD: build + auto-deploy to EC2 on push to main
```

---

## 🏗️ System Architecture & Workflow

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Browser)"]
        UI["React 18 SPA (Vite)"]
        AxiosCtx["Auth Context & Axios Interceptor"]
        WSClient["STOMP WebSocket Client (SockJS)"]
    end

    subgraph Proxy ["Nginx Reverse Proxy (Port 80) — EC2"]
        NginxStatic["Serve Static Files (React dist)"]
        NginxAPI["Proxy /api/ → Spring Boot :8085"]
        NginxWS["Proxy /ws/ → Spring Boot :8085 (WebSocket Upgrade)"]
    end

    subgraph Security ["Security & Auth Layer"]
        JwtFilter["JWT Authentication Filter"]
        SecConfig["Spring Security Config (CORS + Route Rules)"]
    end

    subgraph Backend ["Backend API Layer (Spring Boot 3 / Java 21)"]
        AuthCtrl["Auth Controller"]
        SessionCtrl["Session Controller"]
        BillCtrl["Bill Controller"]
        SpinnerCtrl["Spinner Controller"]
        StompBroker["STOMP WebSocket Broker"]
    end

    subgraph Services ["Service & Integration Layer"]
        BusinessSvc["Business Logic Services"]
        SplitCalc["Split Calculator Service"]
        GeminiSvc["Gemini AI Service (Receipt OCR)"]
        QrSvc["QR Code Service"]
        Repos["Spring Data JPA Repositories"]
    end

    subgraph Storage ["Storage & Cache Layer"]
        MySQL["Amazon RDS — MySQL 8.x"]
        Redis["Redis (Session Cache & Pub/Sub)"]
        S3["Amazon S3 (PDF Receipts)"]
    end

    subgraph External ["External Services"]
        Gemini["Google Gemini AI API"]
        GoogleOAuth["Google OAuth 2.0"]
    end

    UI -->|"HTTP + Bearer Token"| NginxAPI
    WSClient -->|"WebSocket /ws/"| NginxWS
    UI --> NginxStatic

    NginxAPI --> JwtFilter
    NginxWS --> StompBroker

    JwtFilter --> SecConfig
    SecConfig --> Backend

    AuthCtrl --> BusinessSvc
    SessionCtrl --> BusinessSvc
    BillCtrl --> BusinessSvc
    SpinnerCtrl --> BusinessSvc

    BusinessSvc --> SplitCalc
    BusinessSvc --> GeminiSvc
    BusinessSvc --> QrSvc
    BusinessSvc --> Repos

    StompBroker <-->|"Real-time Push /topic/session/{id}"| WSClient
    BusinessSvc -->|"Broadcast Events"| StompBroker
    StompBroker <-->|"Pub/Sub"| Redis

    Repos --> MySQL
    BusinessSvc <-->|"Cache + TTL"| Redis
    BillCtrl -->|"Upload PDF"| S3

    GeminiSvc --> Gemini
    AuthCtrl -->|"Token Verify"| GoogleOAuth
```

---

## 🚀 AWS EC2 Deployment Guide

### Prerequisites

| What | Value |
|---|---|
| EC2 | Ubuntu 22.04 LTS, `t3.small` or larger |
| Ports open | 22 (SSH), 80 (HTTP), 443 (HTTPS optional) |
| RDS | MySQL 8.x (or MySQL on same EC2 for testing) |
| S3 bucket | `splitthebill-pdfs` in your region |

---

### Step 1 — First-time Server Setup (run once on EC2)

SSH into your fresh EC2 instance and run:

```bash
# Copy the setup script to EC2
scp -i your-key.pem deploy/setup-server.sh ubuntu@<EC2_IP>:~

# SSH in and run it
ssh -i your-key.pem ubuntu@<EC2_IP>
bash ~/setup-server.sh
```

This installs: **Java 21 · Nginx · Redis · Node.js 20** and configures the systemd service + Nginx reverse proxy.

---

### Step 2 — Configure Environment Variables on EC2

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<EC2_IP>

# Create the env file from template
sudo nano /opt/splitthebill/.env
```

Fill in the values from [`deploy/.env.template`](deploy/.env.template):

```env
DB_HOST=<your-rds-endpoint>.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=YOUR_RDS_PASSWORD
JWT_SECRET=<generate with: openssl rand -base64 64>
FRONTEND_URL=http://<EC2_PUBLIC_IP>
AWS_ACCESS_KEY=...
AWS_SECRET_KEY=...
AWS_REGION=ap-south-1
GEMINI_API_KEY=...
SPRING_PROFILES_ACTIVE=prod
```

---

### Step 3 — Deploy the App (from your local machine)

Edit [`deploy/deploy.sh`](deploy/deploy.sh) and set your EC2 details:

```bash
EC2_USER="ubuntu"
EC2_HOST="<your-ec2-public-ip>"
EC2_KEY="/path/to/your-key.pem"
```

Then run:

```bash
bash deploy/deploy.sh
```

This will:
1. Build the React frontend (`npm run build`)
2. Build the Spring Boot JAR (`mvn clean package`)
3. SCP the JAR to `/opt/splitthebill/app.jar` on EC2
4. SCP the frontend `dist/` to `/var/www/splitthebill/`
5. Restart the `splitthebill` systemd service

---

### Step 4 — CI/CD Auto-Deploy (GitHub Actions)

On every push to `main`, the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) will:
- Build backend JAR and frontend dist
- SCP both to your EC2
- Restart the service

**Add these GitHub Secrets** (`Settings → Secrets → Actions`):

| Secret | Value |
|---|---|
| `EC2_HOST` | Your EC2 public IP |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Contents of your `.pem` key file |
| `VITE_API_URL` | `http://<EC2_IP>/api` |
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |

---

### Step 5 — Verify Deployment

```bash
# Check service status
ssh -i your-key.pem ubuntu@<EC2_IP> 'sudo systemctl status splitthebill'

# Tail logs
ssh -i your-key.pem ubuntu@<EC2_IP> 'tail -f /var/log/splitthebill/app.log'

# Quick health check
curl http://<EC2_IP>/api/actuator/health
```

App should be live at: **`http://<EC2_IP>`**

---

## 💻 Local Development

### Backend

```bash
cd backend
# Set env vars or edit application.properties for local DB
mvn spring-boot:run
# Runs on http://localhost:8085
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

> The frontend uses `VITE_API_URL` from `.env.local` in dev mode.  
> Create `frontend/.env.local`:
> ```env
> VITE_API_URL=http://localhost:8085/api
> ```

---

## 🔑 Required Credentials

| Credential | Where to get |
|---|---|
| MySQL RDS | AWS RDS Console |
| JWT Secret | `openssl rand -base64 64` |
| AWS S3 keys | AWS IAM Console |
| Gemini API key | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Google OAuth | [Google Cloud Console](https://console.cloud.google.com) |

---

## 📜 License

MIT License — see [LICENSE](LICENSE)
