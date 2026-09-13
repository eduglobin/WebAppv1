# ---- Stage 1: Build with JDK 21 & Gradle Wrapper ----
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# Copy gradle wrapper & configuration files first for layer caching
COPY build.gradle.kts settings.gradle.kts gradle.properties gradlew ./
COPY gradle ./gradle
RUN chmod +x ./gradlew && ./gradlew dependencies --no-daemon || true

# Copy source code and build production jar
COPY src ./src
RUN ./gradlew bootJar -x test --no-daemon

# ---- Stage 2: Runtime ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Run as non-root user for security
RUN addgroup -S eduglobin && adduser -S eduglobin -G eduglobin
USER eduglobin:eduglobin

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseG1GC", "-Xmx512m", "-XX:MaxMetaspaceSize=256m", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]

