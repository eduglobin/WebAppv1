import org.springframework.boot.gradle.tasks.bundling.BootJar

plugins {
    java
    id("org.springframework.boot") version "3.4.1"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.eduglobin"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // ── Web ────────────────────────────────────────────────────────────
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-aop")

    // ── Security / Auth ────────────────────────────────────────────────
    // Validates Supabase-issued JWTs as an OAuth2 Resource Server (HMAC HS256)
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")

    // ── Data / DB ──────────────────────────────────────────────────────
    // Spring Data JDBC preferred over JPA for tight transaction control (seat locks)
    implementation("org.springframework.boot:spring-boot-starter-data-jdbc")
    runtimeOnly("org.postgresql:postgresql")

    // ── Flyway ─────────────────────────────────────────────────────────
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")

    // ── Redis / Lettuce ────────────────────────────────────────────────
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    // Lettuce is pulled in transitively; Jedis excluded by default

    // ── Utilities & PDF Reporting ──────────────────────────────────────
    implementation("com.github.librepdf:openpdf:2.0.3")
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // ── Test ───────────────────────────────────────────────────────────
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()
    minHeapSize = "64m"
    maxHeapSize = "256m"
    jvmArgs("-XX:+EnableDynamicAgentLoading", "-Xshare:off")
}

tasks.named<BootJar>("bootJar") {
    archiveFileName.set("eduglobin-backend.jar")
}

tasks.withType<org.springframework.boot.gradle.tasks.run.BootRun> {
    val envFile = file("../.env")
    if (envFile.exists()) {
        envFile.readLines().forEach { line ->
            val trimmed = line.trim()
            if (trimmed.isNotEmpty() && !trimmed.startsWith("#") && trimmed.contains("=")) {
                val parts = trimmed.split("=", limit = 2)
                environment(parts[0].trim(), parts[1].trim())
            }
        }
    }
}

tasks.withType<JavaCompile> {
    options.isFork = false
}
