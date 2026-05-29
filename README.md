# ðŸ¨ SplitTheBill

**A bill splitter web application.** A host creates a session with a QR code â†’ Friends join via QR scan (no app needed) â†’ Bill items are added live â†’ System calculates each person's share â†’ Friends transfer money to host â†’ Host confirms â†’ Session settles. Includes a **Canvas spinner wheel** for fun (e.g., "Who pays the tip?").

---

## ðŸ› ï¸ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3.4, Spring Security + JWT |
| Database | MySQL 8 |
| Cache | Redis |
| Real-time | Spring WebSocket + STOMP |
| Frontend | React 18, Vite, Bootstrap 5 |
| QR Code | ZXing |
| Deployment | Docker, AWS EC2 + RDS + S3 |

---

## ðŸš€ Local Development Setup

### Prerequisites
- Java 21+
- Maven 3.9+
- Node.js 18+
- MySQL 8 running locally
- Redis running locally (or Docker)

### 1. Setup MySQL
```sql
CREATE DATABASE SplitTheBill_db;
```

### 2. Start Redis (if not running)
```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine
```

### 3. Configure Backend
Edit `backend/src/main/resources/application.yml`:
```yaml
spring:
  datasource:
    username: your_mysql_user
    password: your_mysql_password
```

### 4. Run Backend
```bash
cd backend
mvn spring-boot:run
```
Backend starts at http://localhost:8080

### 5. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend starts at http://localhost:5173

---

## ðŸ“– User Flow

```
Host Creates Session â†’ Room Code + QR Generated
         â†“
Friends Scan QR â†’ Enter Name â†’ Join (live on host screen)
         â†“
Host Starts Session â†’ Timer Begins
         â†“
Anyone Adds Bill Items â†’ Total calculated live
         â†“
Spin the Wheel (optional fun!) â†’ Who pays the tip?
         â†“
Host Closes Session â†’ 5-min grace period for final items
         â†“
Host Calculates Shares â†’ Each person sees their amount
         â†“
Friends Transfer (GPay/Cash) â†’ Mark as Paid
         â†“
Host Confirms Each Payment
         â†“
All Confirmed â†’ Pay Hotel â†’ SESSION SETTLED âœ…
```

---

## ðŸ”— Key API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | âŒ | Register as host |
| POST | `/api/auth/login` | âŒ | Login â†’ JWT |
| POST | `/api/sessions` | âœ… JWT | Create session |
| GET | `/api/sessions/{code}` | âŒ | Get session info |
| POST | `/api/sessions/{code}/join` | âŒ | Guest joins |
| POST | `/api/sessions/{code}/start` | âœ… Host | Start ordering |
| POST | `/api/sessions/{code}/close` | âœ… Host | Enter grace period |
| POST | `/api/sessions/{code}/calculate` | âœ… Host | Calculate shares |
| POST | `/api/sessions/{code}/spin` | âœ… Host | Spin the wheel |
| POST | `/api/members/{id}/mark-paid` | âŒ | Guest marks paid |
| POST | `/api/members/{id}/confirm` | âœ… Host | Confirm payment |
| POST | `/api/sessions/{code}/settle` | âœ… Host | Settle session |

---

## ðŸ³ Docker Build

```bash
cd backend
mvn clean package -DskipTests
docker build -t SplitTheBill-backend .
docker run -p 8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:mysql://host:3306/SplitTheBill_db \
  -e SPRING_DATASOURCE_USERNAME=root \
  -e SPRING_DATASOURCE_PASSWORD=password \
  SplitTheBill-backend
```

---

## â˜ï¸ AWS Deployment

1. **EC2** â€” Run Spring Boot Docker container
2. **RDS MySQL 8** â€” Update `application.yml` with RDS endpoint
3. **ElastiCache Redis** â€” Update Redis host
4. **S3** â€” Build React and deploy as static site:
   ```bash
   cd frontend
   npm run build
   aws s3 sync dist/ s3://your-bucket-name --delete
   ```
5. **GitHub Actions** â€” CI/CD workflow in `.github/workflows/`

---

## ðŸ“ Project Structure

```
SplitBill/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ src/main/java/com/SplitTheBill/
â”‚   â”‚   â”œâ”€â”€ config/          â† Security, WebSocket, Redis config
â”‚   â”‚   â”œâ”€â”€ controller/      â† REST controllers
â”‚   â”‚   â”œâ”€â”€ dto/             â† Request/Response DTOs
â”‚   â”‚   â”œâ”€â”€ entity/          â† JPA entities
â”‚   â”‚   â”œâ”€â”€ exception/       â† Custom exceptions + global handler
â”‚   â”‚   â”œâ”€â”€ repository/      â† JPA repositories
â”‚   â”‚   â””â”€â”€ service/         â† Business logic
â”‚   â”œâ”€â”€ pom.xml
â”‚   â””â”€â”€ Dockerfile
â””â”€â”€ frontend/
    â”œâ”€â”€ src/
    â”‚   â”œâ”€â”€ components/      â† Navbar, SpinnerWheel
    â”‚   â”œâ”€â”€ context/         â† AuthContext
    â”‚   â”œâ”€â”€ pages/           â† All 8 pages
    â”‚   â””â”€â”€ services/        â† Axios API client
    â””â”€â”€ .env
```

---

*Built with â¤ï¸ for SplitTheBill Â· Java + Spring Boot + React*
