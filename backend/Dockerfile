# ---- Stage 1: Build with Gradle ----
FROM gradle:8.11-jdk21-alpine AS build
WORKDIR /app

# Cache dependencies
COPY build.gradle.kts settings.gradle.kts gradle.properties ./
RUN gradle dependencies --no-daemon || true

# Copy source code and build production jar
COPY src ./src
RUN gradle bootJar -x test --no-daemon

# ---- Stage 2: Runtime ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Run as non-root user for security
RUN addgroup -S eduglobin && adduser -S eduglobin -G eduglobin
USER eduglobin:eduglobin

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
