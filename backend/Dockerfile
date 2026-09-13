# ---- Stage 1: Build & Package Stage ----
FROM amazoncorretto:21-alpine AS build
WORKDIR /app

# Copy build definition, wrapper, and source
COPY build.gradle.kts settings.gradle.kts gradle.properties gradlew ./
COPY gradle ./gradle
COPY src ./src
COPY build/libs/ ./build/libs/

# Build jar if not already pre-compiled
RUN if [ ! -f ./build/libs/*.jar ]; then chmod +x ./gradlew && ./gradlew bootJar -x test --no-daemon; fi

# ---- Stage 2: Fast Runtime Stage ----
FROM amazoncorretto:21-alpine
WORKDIR /app

# Run as non-root user for security
RUN addgroup -S eduglobin && adduser -S eduglobin -G eduglobin
USER eduglobin:eduglobin

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseG1GC", "-Xmx512m", "-XX:MaxMetaspaceSize=256m", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]



