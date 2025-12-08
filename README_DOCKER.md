# 🐳 Yatra Docker Deployment - Complete Guide

## 🎯 One-Command Deployment

### Build and Push All Services to Docker Hub

**Windows:**
```batch
build-and-push.bat
```

**Linux/Mac:**
```bash
chmod +x build-and-push.sh && ./build-and-push.sh
```

### Run All Services Locally

```bash
docker-compose -f docker-compose.all.yml up -d
```

## 📦 What Gets Built

This repository contains **3 Docker services**:

1. **yatra-backend** → Node.js API server (port 3000)
2. **yatra-frontend** → Main website (port 80)
3. **yatra-admin-frontend** → Admin panel (port 8080)

All services are built from a **single repository** and can be pushed to Docker Hub together.

## 🚀 Quick Start

### 1. Configure Docker Hub Username

Edit `build-and-push.bat` (Windows) or `build-and-push.sh` (Linux):
```batch
set DOCKER_USERNAME=yourusername
```

### 2. Login to Docker Hub
```bash
docker login
```

### 3. Build and Push
```batch
build-and-push.bat
```

### 4. Deploy
```bash
docker-compose -f docker-compose.all.yml up -d
```

## 📁 Files Overview

| File | Purpose |
|------|---------|
| `docker-compose.all.yml` | Builds all services from source |
| `docker-compose.prod.yml` | Pulls images from Docker Hub |
| `build-and-push.bat` | Windows script to build & push |
| `build-and-push.sh` | Linux/Mac script to build & push |

## 🌐 Access Services

After deployment:
- **Frontend:** http://localhost:80
- **Admin Panel:** http://localhost:8080
- **Backend API:** http://localhost:3000

## 📚 Documentation

- **Complete Guide:** `DOCKER_DEPLOYMENT_GUIDE.md`
- **Quick Reference:** `QUICK_DOCKER_DEPLOY.md`
- **Setup Guide:** `DOCKER_COMPLETE_SETUP.md`

## 🔧 Environment Variables

Create `.env` file:
```env
DB_PASSWORD=your_password
DB_USER=yatra_user
DB_NAME=yatra_db
JWT_SECRET=your_jwt_secret_key
CORS_ORIGIN=http://localhost:80,http://localhost:8080
```

## ✅ Verify Deployment

```bash
# Check containers
docker ps

# Check logs
docker-compose -f docker-compose.all.yml logs -f

# Test backend
curl http://localhost:3000/health
```

## 🔄 Update Process

1. Make code changes
2. Run `build-and-push.bat` to rebuild and push
3. On server: `docker-compose -f docker-compose.prod.yml pull && docker-compose -f docker-compose.prod.yml up -d`

---

**That's it!** All three services are now containerized and ready to deploy. 🎉

