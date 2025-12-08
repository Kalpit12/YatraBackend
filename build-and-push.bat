@echo off
REM Yatra Docker Build and Push Script for Windows
REM Replace 'yourusername' with your Docker Hub username

set DOCKER_USERNAME=yourusername
set VERSION=v1.0

echo 🐳 Building Yatra Docker Images...
echo.

REM Build Backend
echo 📦 Building backend...
cd yatra-backend
docker build -t %DOCKER_USERNAME%/yatra-backend:latest .
docker tag %DOCKER_USERNAME%/yatra-backend:latest %DOCKER_USERNAME%/yatra-backend:%VERSION%
cd ..

REM Build Frontend
echo 📦 Building frontend...
cd yatra-frontend
docker build -t %DOCKER_USERNAME%/yatra-frontend:latest .
docker tag %DOCKER_USERNAME%/yatra-frontend:latest %DOCKER_USERNAME%/yatra-frontend:%VERSION%
cd ..

REM Build Admin
echo 📦 Building admin panel...
cd yatra-admin-frontend
docker build -t %DOCKER_USERNAME%/yatra-admin:latest .
docker tag %DOCKER_USERNAME%/yatra-admin:latest %DOCKER_USERNAME%/yatra-admin:%VERSION%
cd ..

echo.
echo ✅ Build complete!
echo.
set /p PUSH="Push to Docker Hub? (y/n): "
if /i "%PUSH%"=="y" (
    echo 🚀 Pushing to Docker Hub...
    docker push %DOCKER_USERNAME%/yatra-backend:latest
    docker push %DOCKER_USERNAME%/yatra-backend:%VERSION%
    docker push %DOCKER_USERNAME%/yatra-frontend:latest
    docker push %DOCKER_USERNAME%/yatra-frontend:%VERSION%
    docker push %DOCKER_USERNAME%/yatra-admin:latest
    docker push %DOCKER_USERNAME%/yatra-admin:%VERSION%
    echo.
    echo ✅ All images pushed to Docker Hub!
    echo    https://hub.docker.com/r/%DOCKER_USERNAME%/
)

pause

