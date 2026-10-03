# EduGlobin Setup Instructions

This document provides step-by-step instructions for setting up and running the EduGlobin project on your local machine.

There are two ways to run the project depending on your goal:
1. **Developer Mode (Local Build):** Best if you want to actively edit code and test changes.
2. **Production Mode (Cloud Image):** Best if you just want to run the finished application without installing development tools.

---

## Option 1: Developer Mode (Local Build)

Use this method if you plan to write code or modify the application. Because the Dockerfile is heavily optimized for speed, you must compile the Java application locally first, and then Docker will containerize it.

### Prerequisites
1. **Git**
2. **Java 21 (JDK)**
3. **Docker Desktop**
4. *(Optional)* **Node.js 20** (only if you want to run the frontend outside of Docker)

### Steps

**1. Clone the Repository**
```bash
git clone https://github.com/eduglobin/WebAppv1.git
cd WebAppv1
```

**2. Set Up Environment Variables**
Copy the example `.env` files to configure local database/Redis connections.
*(On Windows PowerShell, use `copy` instead of `cp`)*:
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

**3. Build the Backend JAR (Important!)**
The `gradlew` wrapper will automatically download Gradle for you.
```bash
cd backend

# On Mac/Linux:
./gradlew bootJar -x test --no-daemon

# On Windows (PowerShell/CMD):
.\gradlew.bat bootJar -x test --no-daemon

cd ..
```

**4. Start the Full Stack (Database, Redis, Backend, Frontend)**
Let Docker handle everything else. The `--build` flag ensures it picks up the newly built `.jar` file.
```bash
docker compose up -d --build
```

**5. Access the App**
- **Main Web Portal (Student & Owner):** [http://localhost:5173](http://localhost:5173)
- **Backend API & Health Check:** [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health)

*(To stop the app, run `docker compose down`)*

---

## Option 2: Production Mode (Cloud Image)

Use this method if you just want to test or deploy the finished application. You will pull the exact Docker images that were pre-built by our GitHub Actions CI/CD pipeline. No Java compilation is required.

### Prerequisites
1. **Docker Desktop**
2. **A GitHub Account** and a **Personal Access Token (PAT)** with `read:packages` permissions.

### Steps

**1. Log in to GitHub Container Registry (GHCR)**
```bash
docker login ghcr.io -u <your-github-username>
# When prompted for a password, paste your GitHub Personal Access Token
```

**2. Create the Production Compose File**
Create a file named `docker-compose.prod.yml` in an empty directory and paste the following:

```yaml
version: "3.9"
services:
  postgres:
    image: postgis/postgis:15-3.3-alpine
    environment:
      POSTGRES_DB: eduglobin
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: Eduglobin2026@
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    image: ghcr.io/eduglobin/webappv1/backend:latest
    ports:
      - "8080:8080"
    environment:
      SPRING_PROFILES_ACTIVE: prod
      UPSTASH_REDIS_URL: redis://redis:6379
      UPSTASH_REDIS_PASSWORD: ""
      REDIS_SSL_ENABLED: "false"

  frontend:
    image: ghcr.io/eduglobin/webappv1/frontend:latest
    ports:
      - "5173:80"
```

**3. Pull and Run**
Download the latest images from GitHub and start the app:
```bash
# Pull the latest cloud images
docker compose -f docker-compose.prod.yml pull

# Start everything up
docker compose -f docker-compose.prod.yml up -d
```

**4. Access the App**
- **Web Portal:** [http://localhost:5173](http://localhost:5173)

*(To stop the app, run `docker compose -f docker-compose.prod.yml down`)*
