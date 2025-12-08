# 🚀 Quick Docker Deployment Guide

## Build and Push All Services to Docker Hub

### 1. Login to Docker Hub
```bash
docker login
```

### 2. Update Your Docker Hub Username

**Windows:** Edit `build-and-push.bat`:
```batch
set DOCKER_USERNAME=yourusername
```

**Linux/Mac:** Edit `build-and-push.sh`:
```bash
DOCKER_USERNAME="yourusername"
```

### 3. Run Build Script

**Windows:**
```batch
build-and-push.bat
```

**Linux/Mac:**
```bash
chmod +x build-and-push.sh
./build-and-push.sh
```

### 4. Deploy Locally

```bash
docker-compose -f docker-compose.all.yml up -d
```

### 5. Deploy from Docker Hub (Production)

1. Update `docker-compose.prod.yml` with your Docker Hub username
2. Run:
```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Services

- **Frontend:** http://localhost:80
- **Admin:** http://localhost:8080  
- **Backend API:** http://localhost:3000

## Check Status

```bash
docker-compose -f docker-compose.all.yml ps
docker-compose -f docker-compose.all.yml logs -f
```

