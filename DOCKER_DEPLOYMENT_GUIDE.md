# 🐳 Yatra Complete Docker Deployment Guide

This guide shows you how to build and push all three Yatra services (Frontend, Backend, Admin) to Docker Hub from a single repository.

## 📁 Repository Structure

```
YATRA/
├── yatra-backend/          # Node.js API Server
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── yatra-frontend/          # Main Website (Nginx)
│   ├── Dockerfile
│   ├── index.html
│   └── api-integration.js
├── yatra-admin-frontend/   # Admin Panel (Nginx)
│   ├── Dockerfile
│   ├── index.html
│   └── api-integration.js
├── docker-compose.all.yml   # Complete stack
└── build-and-push.bat      # Windows build script
```

## 🚀 Quick Start - Build and Push to Docker Hub

### Step 1: Login to Docker Hub

```bash
docker login
```

Enter your Docker Hub username and password.

### Step 2: Update Docker Hub Username

Edit `build-and-push.bat` (Windows) or `build-and-push.sh` (Linux/Mac) and replace `yourusername` with your Docker Hub username:

**Windows (`build-and-push.bat`):**
```batch
set DOCKER_USERNAME=yourusername
```

**Linux/Mac (`build-and-push.sh`):**
```bash
DOCKER_USERNAME="yourusername"
```

### Step 3: Build and Push All Images

**Windows:**
```batch
build-and-push.bat
```

**Linux/Mac:**
```bash
chmod +x build-and-push.sh
./build-and-push.sh
```

This will:
1. Build all three Docker images
2. Tag them with `latest` and `v1.0`
3. Optionally push to Docker Hub

## 📦 Manual Build Commands

If you prefer to build manually:

### Build Backend
```bash
cd yatra-backend
docker build -t yourusername/yatra-backend:latest .
docker push yourusername/yatra-backend:latest
cd ..
```

### Build Frontend
```bash
cd yatra-frontend
docker build -t yourusername/yatra-frontend:latest .
docker push yourusername/yatra-frontend:latest
cd ..
```

### Build Admin Panel
```bash
cd yatra-admin-frontend
docker build -t yourusername/yatra-admin:latest .
docker push yourusername/yatra-admin:latest
cd ..
```

## 🏃 Run Locally with Docker Compose

### Option 1: Build from Source
```bash
docker-compose -f docker-compose.all.yml up -d
```

### Option 2: Pull from Docker Hub
Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    # ... (same as docker-compose.all.yml)

  backend:
    image: yourusername/yatra-backend:latest
    # ... (same as docker-compose.all.yml)

  frontend:
    image: yourusername/yatra-frontend:latest
    # ... (same as docker-compose.all.yml)

  admin:
    image: yourusername/yatra-admin:latest
    # ... (same as docker-compose.all.yml)
```

Then run:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🌐 Deploy to Production

### Using Docker Compose on Server

1. **Clone repository:**
```bash
git clone https://github.com/yourusername/Yatra.git
cd Yatra
```

2. **Create `.env` file:**
```env
DB_PASSWORD=your_secure_password
DB_USER=yatra_user
DB_NAME=yatra_db
JWT_SECRET=your_jwt_secret_key
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com
```

3. **Start all services:**
```bash
docker-compose -f docker-compose.all.yml up -d
```

4. **Check status:**
```bash
docker-compose -f docker-compose.all.yml ps
docker-compose -f docker-compose.all.yml logs -f
```

### Using Docker Hub Images on Server

1. **Create `docker-compose.prod.yml`** (see above)

2. **Pull and start:**
```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Service Ports

- **Frontend (Main Website):** `http://localhost:80`
- **Admin Panel:** `http://localhost:8080`
- **Backend API:** `http://localhost:3000`
- **MySQL Database:** `localhost:3306`

## 📝 Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DB_PASSWORD=your_secure_password
DB_USER=yatra_user
DB_NAME=yatra_db

# Backend
JWT_SECRET=your_jwt_secret_key_min_32_chars
CORS_ORIGIN=http://localhost:80,http://localhost:8080
NODE_ENV=production

# Ports (optional, defaults shown)
DB_PORT=3306
PORT=3000
```

## 🔍 Verify Deployment

### Check Running Containers
```bash
docker ps
```

You should see:
- `yatra-mysql`
- `yatra-backend`
- `yatra-frontend`
- `yatra-admin`

### Check Logs
```bash
# All services
docker-compose -f docker-compose.all.yml logs -f

# Specific service
docker-compose -f docker-compose.all.yml logs -f backend
docker-compose -f docker-compose.all.yml logs -f frontend
docker-compose -f docker-compose.all.yml logs -f admin
```

### Test Endpoints
```bash
# Backend health
curl http://localhost:3000/health

# Frontend
curl http://localhost:80

# Admin
curl http://localhost:8080
```

## 🛑 Stop Services

```bash
docker-compose -f docker-compose.all.yml down
```

To remove volumes (⚠️ deletes database):
```bash
docker-compose -f docker-compose.all.yml down -v
```

## 🔄 Update Deployment

1. **Pull latest code:**
```bash
git pull origin master
```

2. **Rebuild and push:**
```bash
build-and-push.bat  # or build-and-push.sh
```

3. **On server, pull and restart:**
```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 📚 Docker Hub Images

After pushing, your images will be available at:
- `https://hub.docker.com/r/yourusername/yatra-backend`
- `https://hub.docker.com/r/yourusername/yatra-frontend`
- `https://hub.docker.com/r/yourusername/yatra-admin`

## 🐛 Troubleshooting

### Images not building
- Check Docker is running: `docker ps`
- Verify Dockerfiles exist in each directory
- Check build logs: `docker build -t test ./yatra-backend`

### Services not starting
- Check logs: `docker-compose logs`
- Verify environment variables in `.env`
- Ensure ports are not in use: `netstat -an | grep :3000`

### Database connection issues
- Wait for MySQL to be healthy: `docker-compose ps`
- Check MySQL logs: `docker-compose logs mysql`
- Verify DB credentials in `.env`

## 📞 Support

For issues, check:
1. Docker logs: `docker-compose logs`
2. Container status: `docker ps -a`
3. Network connectivity: `docker network ls`

