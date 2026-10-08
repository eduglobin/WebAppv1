---
id: api-gateway
title: Kong API Gateway
sidebar_position: 2
---

# Kong API Gateway

EduGlobin uses **Kong** as the central API Gateway to route traffic to the appropriate backend and frontend services.

## Architecture

```mermaid
graph TD
    Client[Client Browser/App] --> Kong[Kong API Gateway (Port 8000)]
    Kong -->|/api/*| Backend[Spring Boot Backend (Port 8080)]
    Kong -->|/*| Frontend[Vite Frontend (Port 80)]
```

## Configuration

Kong is deployed using a declarative, DB-less configuration (`kong.yml`) mounted into the Docker container. 

The configuration ensures that all requests strictly pass through the gateway:
- Routes `/api` paths to the Java backend.
- Routes all other paths to the React frontend.

This allows us to introduce centralized rate limiting, authentication layers, and analytics plugins in the future without modifying the microservices.
