# ---- Runtime Stage (jar pre-built by CI runner) ----
# The bootJar is built on the CI runner (which has Gradle cache)
# and COPY'd into this image — no network access needed at build time.
FROM amazoncorretto:21-alpine
WORKDIR /app

# Run as non-root user for security
RUN addgroup -S eduglobin && adduser -S eduglobin -G eduglobin
USER eduglobin:eduglobin

COPY build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseG1GC", "-Xmx512m", "-XX:MaxMetaspaceSize=256m", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
