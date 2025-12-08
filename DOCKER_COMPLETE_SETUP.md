# 🐳 Complete Docker Setup - All Services in One Repo

## Overview

This repository contains **three services** that can be built and deployed together:

1. **yatra-backend** - Node.js API server
2. **yatra-frontend** - Main website (Nginx)
3. **yatra-admin-frontend** - Admin panel (Nginx)

## 🎯 Quick Start

### Build and Push to Docker Hub (One Command)

**Windows:**
```batch
build-and-push.bat
```

**Linux/Mac:**
```bash
./build-and-push.sh
```

This script will:
- ✅ Build all three Docker images
- ✅ Tag them with `latest` and version tags
- ✅ Push to Docker Hub (optional)

### Run Locally

```bash
docker-compose -f docker-compose.all.yml up -d
```

Access:
- Frontend: http://localhost:80
- Admin: http://localhost:8080
- Backend API: http://localhost:3000

## 📋 Step-by-Step Guide

### Step 1: Configure Docker Hub Username

Edit `build-and-push.bat` (or `.sh` for Linux):
```batch
set DOCKER_USERNAME=yourusername
```

### Step 2: Login to Docker Hub

```bash
docker login
```

### Step 3: Build and Push

Run the build script - it will build all three images and optionally push them.

### Step 4: Deploy

**Option A: Build from source (development)**
```bash
docker-compose -f docker-compose.all.yml up -d
```

**Option B: Pull from Docker Hub (production)**
1. Update `docker-compose.prod.yml` with your Docker Hub username
2. Run:
```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 📁 Repository Structure

```
YATRA/
├── yatra-backend/
│   ├── Dockerfile          # Backend container config
│   ├── package.json
│   └── server.js
├── yatra-frontend/
│   ├── Dockerfile          # Frontend container config
│   ├── index.html
│   └── api-integration.js
├── yatra-admin-frontend/
│   ├── Dockerfile          # Admin container config
│   ├── index.html
│   └── api-integration.js
├── docker-compose.all.yml  # Complete stack (builds from source)
├── docker-compose.prod.yml # Production (pulls from Docker Hub)
└── build-and-push.bat      # Build & push script
```

## 🔧 Manual Build (If Needed)

### Backend
```bash
cd yatra-backend
docker build -t yourusername/yatra-backend:latest .
docker push yourusername/yatra-backend:latest
```

### Frontend
```bash
cd yatra-frontend
docker build -t yourusername/yatra-frontend:latest .
docker push yourusername/yatra-frontend:latest
```

### Admin
```bash
cd yatra-admin-frontend
docker build -t yourusername/yatra-admin:latest .
docker push yourusername/yatra-admin:latest
```

## 🌐 Production Deployment

### On Your Server

1. **Clone repository:**
```bash
git clone https://github.com/yourusername/Yatra.git
cd Yatra
```

2. **Create `.env` file:**
```env
DB_PASSWORD=secure_password_here
DB_USER=yatra_user
DB_NAME=yatra_db
JWT_SECRET=your_jwt_secret_min_32_chars
CORS_ORIGIN=https://yourdomain.com
```

3. **Update `docker-compose.prod.yml`** with your Docker Hub username

4. **Deploy:**
```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 🔍 Verify Deployment

```bash
# Check running containers
docker ps

# Check logs
docker-compose -f docker-compose.all.yml logs -f

# Test endpoints
curl http://localhost:3000/health  # Backend
curl http://localhost:80            # Frontend
curl http://localhost:8080         # Admin
```

## 📦 Docker Hub Images

After pushing, your images will be at:
- `https://hub.docker.com/r/yourusername/yatra-backend`
- `https://hub.docker.com/r/yourusername/yatra-frontend`
- `https://hub.docker.com/r/yourusername/yatra-admin`

## 🔄 Update Process

1. **Make changes** to your code
2. **Commit and push** to GitHub
3. **Rebuild and push** Docker images:
   ```bash
   build-and-push.bat
   ```
4. **On server, pull and restart:**
   ```bash
   docker-compose -f docker-compose.prod.yml pull
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 🛑 Stop Services

```bash
docker-compose -f docker-compose.all.yml down
```

## 📚 More Information

- Full guide: `DOCKER_DEPLOYMENT_GUIDE.md`
- Quick reference: `QUICK_DOCKER_DEPLOY.md`
