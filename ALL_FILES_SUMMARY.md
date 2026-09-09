# EduGlobin — Exhaustive File Catalog & Architectural Overview

This document provides a comprehensive, file-by-file breakdown of every single file created or configured across the **EduGlobin** project. Each entry contains an in-depth technical explanation (minimum 3–4 lines) detailing what the file does, its core responsibilities, key functions/endpoints, inputs/outputs, and how it interacts within the system.

---

## Table of Contents
1. [Root Configuration, Docker & Environment](#1-root-configuration-docker--environment)
2. [Database Migrations & Seed Data](#2-database-migrations--seed-data)
3. [Backend: Core Application & Configuration](#3-backend-core-application--configuration)
4. [Backend: Common Utilities & Web Layer](#4-backend-common-utilities--web-layer)
5. [Backend: Authentication Module](#5-backend-authentication-module)
6. [Backend: Library, Geosearch & Onboarding Module](#6-backend-library-geosearch--onboarding-module)
7. [Backend: Booking, Locking, Cancellation & Top-Ups](#7-backend-booking-locking-cancellation--top-ups)
8. [Backend: Modular Placeholders (CRM, Complaints, Gamification)](#8-backend-modular-placeholders-crm-complaints-gamification)
9. [Backend: Automated Test Suite](#9-backend-automated-test-suite)
10. [Frontend: Tooling, Configuration & Entry Points](#10-frontend-tooling-configuration--entry-points)
11. [Frontend: Core Contexts, Internationalization & API Clients](#11-frontend-core-contexts-internationalization--api-clients)
12. [Frontend: Shared UI Components & Custom Hooks](#12-frontend-shared-ui-components--custom-hooks)
13. [Frontend: User-Facing Pages & Routes](#13-frontend-user-facing-pages--routes)
14. [Sprint Documentation & Walkthrough Logs](#14-sprint-documentation--walkthrough-logs)

---

## 1. Root Configuration, Docker & Environment

### [`docker-compose.yml`](file:///e:/EduGlobin/docker-compose.yml)
*   Defines the local containerized infrastructure needed during development, primarily provisioning the local Redis service (`redis:7-alpine`).
*   Configures port mapping `6379:6379`, persistent named volume storage (`redis-data`), health-checking commands (`redis-cli ping`), and restart policies.
*   Enables the backend to run real Redis operations (such as atomic `SETNX` distributed seat-locks and Lua release scripts) on a local developer workstation without requiring an external cloud provider.
*   Acts as the single-command bootstrap (`docker compose up -d`) to ensure caching and concurrency engines are ready before launching Spring Boot.

### [`.env.example`](file:///e:/EduGlobin/.env.example)
*   Serves as the master template document declaring all required environment variables for the Spring Boot backend and database engines.
*   Specifies placeholders for Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`), JDBC connection strings (`SUPABASE_DB_URL`), and Redis endpoints (`REDIS_LOCAL_URL`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_PASSWORD`).
*   Includes configuration keys for external Google Maps/Geocoding services and platform operational flags.
*   Prevents leakage of sensitive production secrets into Git by instructing developers on how to populate their local uncommitted `.env` file.

### [`README.md`](file:///e:/EduGlobin/README.md)
*   The primary landing document for developers onboarding to the EduGlobin monorepo repository.
*   Outlines the complete technology stack across backend (Spring Boot 3.4, Java 21, Spring Data JDBC, Flyway), frontend (React 19, Vite, Tailwind CSS), and managed persistence layers (Supabase Postgres, PostGIS, Upstash Redis).
*   Provides clear step-by-step instructions for cloning, creating environment files, spinning up Docker containers, and running development servers.
*   Catalogs the directory layout to orient engineers regarding module responsibilities and links out to detailed setup and PRD documentation.

### [`SETUP.md`](file:///e:/EduGlobin/SETUP.md)
*   Provides an exhaustive, sequential environment setup manual for local machine initialization across Windows and UNIX environments.
*   Details runtime prerequisites including Java 21 (Temurin LTS), Docker Desktop, Node.js 20 LTS, and PowerShell configuration nuances.
*   Walks through step-by-step console setups for Supabase projects, PostGIS extensions, Upstash Redis credentials, and Google Maps API key restrictions.
*   Provides a dedicated troubleshooting matrix diagnosing common developer pitfalls such as Redis ping failures, JDBC SSL query parameters, and JWT secret decoding mismatches.

---

## 2. Database Migrations & Seed Data

### [`V1__init_schema.sql`](file:///e:/EduGlobin/backend/src/main/resources/db/migration/V1__init_schema.sql)
*   The foundational Flyway migration script establishing the primary baseline relational tables and PostGIS spatial extensions for EduGlobin.
*   Creates core entities: `profiles` (extending Supabase auth users), `libraries` (with spatial `GEOGRAPHY(Point, 4326)` columns and GIST indexing), `shifts`, `seat_desks`, `lockers`, `bookings`, `student_crm_records`, `complaint_tickets`, `checkin_scan_logs`, `audit_logs`, `points_coins_ledger`, and `india_admin_hierarchy`.
*   Enforces strict foreign key constraints, status checks, and coordinate indexing across libraries, seats, and bookings to ensure data integrity up-front.
*   Includes automated trigger definitions (`trg_libraries_updated_at`) to reliably track row update timestamps across the database.

### [`V2__day2_schema.sql`](file:///e:/EduGlobin/backend/src/main/resources/db/migration/V2__day2_schema.sql)
*   Extends the `libraries` table with attributes needed for advanced multi-dimensional filtering, adding `amenities`, `focused_exams`, `is_featured`, `rating`, and `monthly_price`.
*   Creates PostgreSQL Generalized Inverted Indexes (GIN) on array columns (`idx_libraries_amenities` and `idx_libraries_exams`) to optimize high-speed tag searches.
*   Seeds initial verified student coaching hub locations into `india_admin_hierarchy` covering popular academic localities in Indore (Bhawarkua, Vijay Nagar, Palasia) and Kota (Talwandi, Vigyan Nagar).
*   Guarantees that initial geocoding and scoring algorithms have pre-populated spatial test data immediately available upon application launch.

### [`V3__addendum_2_5_schema.sql`](file:///e:/EduGlobin/backend/src/main/resources/db/migration/V3__addendum_2_5_schema.sql)
*   Implements schema alterations required for PRD Addendum v2.5, expanding library onboarding workflows with `onboarding_source`, `approval_status`, `rejection_reason`, and admin approval tracking.
*   Replaces monolithic single-duration locker pricing with granular tiered price columns (`price_hourly`, `price_daily`, `price_weekly`, `price_monthly`) and establishes the `locker_mode` enum.
*   Upgrades the `bookings` table to support diverse pass types (`HOURLY`, `DAILY`, `WEEKLY`, `MONTHLY`), walk-in booking sources, payment modes (`CASH`, `UPI_QR`), and staff confirmation logging.
*   Introduces the `session_topups` table to record incremental payments, cashier IDs, and expiration extensions when students extend active study sessions.

### [`V4__addendum_2_6_schema.sql`](file:///e:/EduGlobin/backend/src/main/resources/db/migration/V4__addendum_2_6_schema.sql)
*   Incorporates features from PRD Addendum v2.6, allowing libraries to be flagged as free (`is_free`) and modifying booking payment constraints to support zero-cost checkouts (`FREE`).
*   Adds the `layout_source` column to `seat_desks` to differentiate simple count generation from visual/parametric seat maps, and adds platform-level support scope to complaints.
*   Establishes price-change governance columns on `shifts` along with a dynamic `platform_config` key-value table to configure approval thresholds without recompilation.
*   Constructs complete financial and operational models for cancellations, tiered refund percentage policies (`cancellation_refund_tiers`), dispute tracking (`booking_disputes`), and student wallets (`student_wallets`, `wallet_transactions`).

### [`lgd_data.csv`](file:///e:/EduGlobin/backend/src/main/resources/seed-data/lgd_data.csv)
*   A curated seed dataset representing Indian administrative boundaries across all 28 states and Union Territories based on the Local Government Directory (LGD).
*   Contains hierarchical rows mapping state, district, tehsil, and village/locality records alongside pre-calculated latitude and longitude coordinates.
*   Explicitly flags prominent student coaching hubs (such as Indore, Kota, Sikar, and Delhi NCR) as featured destinations for prioritized search results.
*   Loaded by backend startup runners to bootstrap comprehensive location search capabilities without relying exclusively on external third-party geocoding calls.

---

## 3. Backend: Core Application & Configuration

### [`EduGlobinApplication.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/EduGlobinApplication.java)
*   The primary Spring Boot application entry point annotated with `@SpringBootApplication`.
*   Includes `@EnableScheduling` to activate asynchronous background cron jobs and scheduled tasks (such as lock reconciliation and owner confirmation expiration sweeps).
*   Houses the standard `main(String[] args)` method initializing the Spring ApplicationContext and running auto-configurations.
*   Acts as the root package coordinator from which component scanning discovers controllers, services, repositories, and security beans.

### [`AppConfig.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/config/AppConfig.java)
*   General application configuration class defining cross-cutting Spring beans and REST communication infrastructure.
*   Instantiates and configures a Spring `RestTemplate` bean equipped with connection timeouts for third-party HTTP communications (such as Supabase Admin APIs and Google Geocoding).
*   Configures Jackson JSON object mapper properties to ensure uniform serialization of timestamps, UUIDs, and snake_case API payloads.
*   Provides centralized bean definitions that can be easily customized or mocked during integration testing.

### [`SecurityConfig.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/config/SecurityConfig.java)
*   Configures Spring Security 6 as a completely stateless OAuth2 Resource Server protecting EduGlobin API endpoints.
*   Validates HMAC-SHA256 JWT tokens issued by Supabase Auth using a `NimbusJwtDecoder` configured with the application's base64-encoded JWT secret.
*   Implements role-based access control (RBAC), mapping custom claims in the token to authorities such as `ROLE_STUDENT`, `ROLE_LIBRARY_OWNER`, and `ROLE_SUPER_ADMIN`.
*   Declares public vs. authenticated route patterns, permitting unrestricted access to actuator health checks, location searches, and library listings while protecting booking mutations.

### [`WebSocketConfig.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/config/WebSocketConfig.java)
*   Implements `WebSocketMessageBrokerConfigurer` to enable real-time bidirectional messaging via STOMP over SockJS.
*   Registers the `/ws` endpoint with cross-origin compatibility (`allowedOriginPatterns("*")`) to accommodate frontend clients across local and preview environments.
*   Configures a simple in-memory message broker routing outbound messages through destination prefixes like `/topic` and application inbound routes via `/app`.
*   Serves as the transport backbone powering instant seat-lock state broadcasts, ensuring all open library detail pages update concurrently without manual page refreshing.

### [`application.yml`](file:///e:/EduGlobin/backend/src/main/resources/application.yml)
*   The core configuration file for the Spring Boot application defining default environment profiles and property values.
*   Specifies Flyway migration parameters, datasource drivers, connection pooling settings, and server listening ports (defaulting to 8080).
*   Configures Spring Data JDBC settings and binds custom properties for Supabase URL, service role keys, and JWT secrets.
*   Sets up WebSocket message broker limits and provides logging levels for internal services and database SQL statement output.

### [`application-local.yml`](file:///e:/EduGlobin/backend/src/main/resources/application-local.yml)
*   Environment-specific profile configuration activated when running Spring Boot locally via `--spring.profiles.active=local`.
*   Points the Redis connection factory to local standalone Docker instances (`redis://localhost:6379`) instead of remote cloud URLs.
*   Disables production-only health actuator checks that might fail in isolated local environments lacking external network access.
*   Provides verbose logging configurations for debugging SQL parameters, Flyway execution logs, and incoming HTTP request headers.

### [`messages_en.properties`](file:///e:/EduGlobin/backend/src/main/resources/messages_en.properties) & [`messages_hi.properties`](file:///e:/EduGlobin/backend/src/main/resources/messages_hi.properties)
*   Internationalization (i18n) resource bundles for backend exception messages, validation alerts, and localized audit notifications in English and Hindi.
*   Contains key-value translations for authentication errors, booking confirmation notices, dispute statuses, and walk-in receipt messages.
*   Allows backend error responses to return culturally relevant and linguistically localized error strings based on the client's `Accept-Language` header.
*   Ensures consistent messaging across both student-facing and administrative interfaces regardless of the user's preferred language.

---

## 4. Backend: Common Utilities & Web Layer

### [`ApiResponse.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/common/ApiResponse.java)
*   A generic, standardized envelope wrapper record used across all REST controller endpoints for uniform API responses (`ApiResponse<T>`).
*   Encapsulates response fields including boolean `success`, descriptive `message`, timestamp `timestamp`, and generic payload `data`.
*   Provides static factory helper methods (`ApiResponse.success(...)`, `ApiResponse.error(...)`) to streamline consistent response creation.
*   Guarantees that frontend API clients can rely on a predictable contract for status inspection, user messaging, and payload unmarshalling.

### [`EduGlobinException.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/common/EduGlobinException.java)
*   The fundamental custom runtime exception class utilized throughout the service and repository layers of EduGlobin.
*   Captures business rule violations, entity not found conditions, authorization rejections, and concurrency locking conflicts.
*   Supports passing custom error codes, detailed operational messages, and root-cause exception objects.
*   Enables clean separation between expected business logic rejections and unexpected low-level internal server faults.

### [`GlobalExceptionHandler.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/common/GlobalExceptionHandler.java)
*   A centralized `@RestControllerAdvice` class intercepting all uncaught exceptions thrown during HTTP request processing.
*   Translates `EduGlobinException` instances into appropriate HTTP response status codes (e.g., 400 Bad Request, 404 Not Found, 409 Conflict) wrapped in `ApiResponse`.
*   Handles Spring validation errors (`MethodArgumentNotValidException`), extracting specific field-level validation messages into a readable list.
*   Catches unexpected generic `Exception` fallbacks, logging the full stack trace securely while returning a clean, unexposed 500 Internal Server Error to the client.

### [`MeController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/common/MeController.java)
*   A REST controller exposing the authenticated profile endpoint `GET /api/v1/me`.
*   Extracts the JWT principal from the active `SecurityContextHolder` using `UserPrincipal` and queries the database for the user's profile record.
*   Returns the authenticated user's ID, email, full name, role (`STUDENT`, `LIBRARY_OWNER`, `STAFF`, `SUPER_ADMIN`), preferred theme, and language.
*   Serves as the primary post-login synchronization gate that frontend routers consult to determine role-based dashboard redirection and authorization.

### [`UserPrincipal.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/common/UserPrincipal.java)
*   A lightweight, immutable domain helper representing the authenticated user context extracted from Spring Security JWT tokens.
*   Provides convenience getters for user UUID (`getId()`), email (`getEmail()`), user role (`getRole()`), and assigned library UUID for staff members.
*   Abstracts away raw Spring Security claims parsing, eliminating repetitive boilerplate code inside controllers and services.
*   Guarantees consistent, type-safe access to caller identity across all transactional service methods.

---

## 5. Backend: Authentication Module

### [`AdminSeedRunner.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/auth/AdminSeedRunner.java)
*   A Spring `CommandLineRunner` component that executes upon backend startup under non-test profiles (`@Profile("!test")`).
*   Checks whether a default Super Admin account (`admin@eduglobin.com`) already exists within the Supabase Auth and `profiles` tables.
*   If absent, safely provisions the admin user via the Supabase Admin REST API with secure password hashing and automatically creates the corresponding `profiles` row with role `SUPER_ADMIN`.
*   Prevents application startup failures by handling duplicate key conflicts idempotently, ensuring seamless bootstrapping on new deployments.

---

## 6. Backend: Library, Geosearch & Onboarding Module

### [`DataSeedRunner.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/DataSeedRunner.java)
*   A startup seed utility designed to populate mock library entities, shifts, and seat layouts for local development and testing.
*   Creates representative libraries in prominent coaching areas (e.g., Bhawarkua in Indore) linked to test owner accounts.
*   Associates libraries with standard shifts (Morning, Evening, Full Day) and populates varied seat desk matrices with differing amenities.
*   Ensures developers and automated UI tests have realistic, functional library data to interact with immediately upon starting the stack.

### [`LgdSeedRunner.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LgdSeedRunner.java)
*   A `CommandLineRunner` that parses `lgd_data.csv` on startup and bulk-inserts administrative location entries into `india_admin_hierarchy`.
*   Uses Spring's `NamedParameterJdbcTemplate` batch update capabilities to execute thousands of inserts in single efficient network operations.
*   Flags recognized educational hubs (Indore, Kota, Sikar, Delhi) with `is_featured_hub = TRUE` for quick discovery.
*   Guarantees that the underlying Indian administrative hierarchy data is seeded before the geocoding services begin resolving query requests.

### [`TehsilGeocodeRunner.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/TehsilGeocodeRunner.java)
*   A specialized startup component responsible for resolving and persisting base geographic coordinates (latitude and longitude) for distinct tehsils.
*   Maintains a built-in static coordinate registry of major Indian districts and tehsils to operate effectively in offline environments.
*   If a Google Geocoding API key is configured, dynamically queries Google APIs for unknown tehsils and caches the retrieved coordinates back to the database.
*   Applies a deterministic regional offset fallback algorithm to prevent null coordinate values, ensuring proximity search math never breaks.

### [`LibraryDetailController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LibraryDetailController.java)
*   Exposes detailed, public library viewing endpoints for the student frontend seat booking interface.
*   Provides `GET /api/v1/libraries/{id}/shifts` returning all defined operational shifts, time ranges, and price tiers for a specific library.
*   Provides `GET /api/v1/libraries/{id}/seats?shiftId=...` fetching all seats and lockers, dynamically evaluating active bookings and Redis locks to return real-time availability states.
*   Enables the frontend seat map to display color-coded desk availability and locker inventory specific to the student's selected shift.

### [`LibraryOnboardingController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LibraryOnboardingController.java)
*   REST controller managing the library submission and administrative review lifecycle according to PRD Module 9.
*   Exposes `POST /api/v1/owner/libraries` allowing library owners to submit complete registration profiles with layout counts and KYC documents.
*   Exposes administrative review endpoints including `GET /api/v1/admin/libraries/pending`, approval actions `PUT /.../approve`, and rejections `PUT /.../reject`.
*   Enforces authorization so that only users with `ROLE_SUPER_ADMIN` can transition library listings from `PENDING_APPROVAL` to live published status.

### [`LibraryOnboardingRequest.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LibraryOnboardingRequest.java)
*   A comprehensive Data Transfer Object (DTO) capturing all parameters required to register and onboard a library.
*   Contains validation annotations (`@NotBlank`, `@NotNull`, `@Min`) for library name, address, coordinates, amenities, focused exams, and KYC document URLs.
*   Encapsulates nested definitions for operational shifts (shift name, timings, daily/monthly pricing) and locker configuration settings.
*   Accepts either a simple total seat count or detailed parametric row/column layout blueprints for initial seat generation.

### [`LibraryOnboardingService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LibraryOnboardingService.java)
*   The transactional service layer managing the business rules of library onboarding and verification.
*   Validates submitted KYC documents, constructs the library database record, and invokes `SimpleCountSeatGenerator` to synthesize seat desks.
*   Handles admin review workflows, updating `approval_status`, persisting rejection reasons, and publishing approved libraries (`is_published = TRUE`).
*   Writes comprehensive audit log records whenever a library status transition occurs to maintain accountability.

### [`Locker.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/Locker.java)
*   Domain entity representation for library storage lockers mapped to the `lockers` database table.
*   Stores locker identification codes, owning library references, and current availability status (`AVAILABLE`, `LOCKED`, `BOOKED`, `IN_USE`).
*   Maintains the tiered pricing structure (`price_hourly`, `price_daily`, `price_weekly`, `price_monthly`) aligned with PRD Module 10.
*   Provides helper accessors to retrieve the correct add-on rental fee corresponding to a student's chosen booking pass type.

### [`LockerConfigDto.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LockerConfigDto.java)
*   A DTO mapping locker configuration parameters submitted by library owners during onboarding or settings management.
*   Contains the chosen `LockerMode` (`NO_LOCKERS`, `FREE_LOCKERS`, `PAID_MANAGED`) and total locker inventory counts.
*   Captures optional tiered price structures when managed paid lockers are enabled.
*   Validates that paid locker configurations provide valid positive currency amounts for each enabled pass duration tier.

### [`LockerController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LockerController.java)
*   REST controller managing locker operational endpoints and check-in verifications.
*   Exposes endpoints allowing owners to update locker inventory and configure tiered pricing rules.
*   Provides staff-facing endpoints for verifying locker check-ins via QR code scans or manual identifier lookups.
*   Integrates with audit logs to track when staff confirm a physical locker key hand-off to a student.

### [`LockerMode.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LockerMode.java)
*   Enumeration specifying the locker operating policy for a given library facility.
*   Defines three explicit modes: `NO_LOCKERS` (facility has no lockers), `FREE_LOCKERS` (complimentary for booked students), and `PAID_MANAGED` (rented for a tiered fee).
*   Governs whether locker add-on selectors appear on the frontend booking checkout interface.
*   Directly drives the pricing resolution engine inside `LockerService` during reservation calculations.

### [`LockerService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LockerService.java)
*   Business logic service managing locker fee calculations, reservations, and physical check-in handoffs.
*   Computes exact locker fees based on library locker mode and seat pass duration (e.g., returning 0 for free lockers, tiered rate for paid, or rejecting if disabled).
*   Allocates available locker desks during checkout and flips statuses atomically alongside seat desk reservations.
*   Validates physical check-in scan events against booking records, logging scan entries in `checkin_scan_logs`.

### [`PriceChangeController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/PriceChangeController.java)
*   REST controller implementing price-change governance according to PRD Module 17.
*   Allows library owners to submit requested adjustments to monthly and daily shift prices.
*   Exposes admin endpoints (`GET /api/v1/admin/price-changes/pending`, `PUT /.../review`) to inspect, approve, or reject pending price increases.
*   Protects students from sudden price gouging by enforcing automated review gates for price hikes exceeding configured thresholds.

### [`PriceChangeService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/PriceChangeService.java)
*   Service enforcing price increase threshold policies by querying the `platform_config` table (default 20% limit).
*   If a proposed shift price increase is within the threshold, automatically applies the change immediately to the shift.
*   If an increase exceeds the threshold, sets the shift's `price_change_status` to `PENDING_ADMIN_APPROVAL` and stages the new price in pending columns.
*   Provides administrative approval routines that commit approved pending prices and record audit entries.

### [`SimpleCountSeatGenerator.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/SimpleCountSeatGenerator.java)
*   Utility service implementing simplified seat creation (PRD Module 14) for library owners without complex custom blueprints.
*   Takes a single integer count of total seats and automatically synthesizes a balanced grid layout (defaulting to 6 seats per row).
*   Generates systematic seat labels (e.g., A1, A2... B1, B2) with row and column indices.
*   Sets default attributes (e.g., standard power sockets, default door distances) and marks the layout source as `SIMPLE_COUNT`.

### [`LibraryCandidate.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/LibraryCandidate.java)
*   Internal data transfer record representing a library retrieved from spatial queries prior to ranking and scoring.
*   Holds raw attributes: library UUID, name, coordinates, physical distance from user in kilometers, rating, amenities, and focused exams.
*   Acts as the input payload passed into `LibraryScoringService` to evaluate multi-attribute match scores.
*   Decouples database spatial retrieval queries from business scoring algorithms.

### [`LibraryScoringService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/LibraryScoringService.java)
*   Implements the multi-factor, deterministic scoring algorithm matching libraries against student preferences.
*   Combines weighted normalized sub-scores: physical distance fit (40%), budget compatibility (25%), exam focus alignment (20%), and amenities match (15%).
*   Gracefully handles missing or unstated preferences by returning neutral baseline scores (0.5) to avoid penalizing libraries unfairly.
*   Returns an aggregate match percentage (0 to 100%) utilized by both the manual search page and the AI Solver recommendation wizard.

### [`LibrarySearchController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/LibrarySearchController.java)
*   REST controller exposing the primary library search endpoint `GET /api/v1/libraries/search`.
*   Accepts HTTP query parameters for latitude, longitude, search radius (km), target exam, maximum budget, required amenities, and sorting preferences.
*   Binds incoming parameters into a `SearchCriteria` object and delegates candidate retrieval and ranking to `LibrarySearchService`.
*   Returns a sorted list of `ScoredLibraryDto` objects wrapped inside a standardized `ApiResponse`.

### [`LibrarySearchRepository.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/LibrarySearchRepository.java)
*   Spring Data JDBC repository executing PostGIS spatial queries against the PostgreSQL database.
*   Uses native SQL queries with PostGIS functions (`ST_DWithin`, `ST_Distance`) to find published libraries within a given radius of coordinates.
*   Applies secondary SQL filter clauses for exam arrays, amenities arrays, and maximum pricing boundaries.
*   Maps raw relational result sets into lightweight `LibraryCandidate` domain models.

### [`LibrarySearchService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/LibrarySearchService.java)
*   Orchestration service coordinating spatial database querying, attribute scoring, and result sorting.
*   Invokes `LibrarySearchRepository` to retrieve candidate libraries located within the requested geographic boundary.
*   Feeds candidates through `LibraryScoringService` to compute individual match scores and attach match breakdown explanations.
*   Sorts results according to user request (e.g., best match score, nearest distance, lowest price, highest rating) and returns finalized DTOs.

### [`LocationController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/LocationController.java)
*   REST controller exposing location search and autocompletion endpoints at `GET /api/v1/locations/search`.
*   Queries `india_admin_hierarchy` using full-text search vector matching (`to_tsvector`) across village, tehsil, district, and state names.
*   Calls `OnDemandVillageGeocodeService` when a user selects a village whose coordinates still reflect its parent tehsil center.
*   Returns lightweight location suggestion lists helping students quickly pin their geographic study location.

### [`LocationResult.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/LocationResult.java)
*   DTO representing a matched geographic location returned to frontend autocomplete inputs.
*   Contains location UUID, display label (e.g., "Bhawarkua, Indore, Madhya Pradesh"), latitude, longitude, and featured hub status.
*   Includes a `precision` enum attribute (`VILLAGE` or `TEHSIL`) indicating coordinate resolution granularity.
*   Informs frontend map components whether coordinates represent exact street localities or broader administrative centers.

### [`OnDemandVillageGeocodeService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/OnDemandVillageGeocodeService.java)
*   Service implementing lazy, on-demand geocoding refinement to conserve external Google Geocoding API quotas.
*   Detects when a selected village record is sharing identical default coordinates with its parent tehsil.
*   If an external geocoding API key is available, queries the API for precise village coordinates and updates the database row asynchronously.
*   If external APIs are unavailable or fail, applies a stable geographic jitter algorithm around the tehsil center as an intelligent fallback.

### [`ScoredLibraryDto.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/ScoredLibraryDto.java)
*   The final customer-facing DTO returned by search and recommendation endpoints.
*   Presents comprehensive library details: UUID, name, address, distance (km), price ranges, photo URLs, amenities, and rating.
*   Includes the overall calculated `matchScore` along with a list of positive match highlight tags (e.g., "Within 2 km", "Matches UPSC prep", "AC available").
*   Provides all visual parameters required by frontend library cards without requiring additional secondary HTTP requests.

### [`SearchCriteria.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/SearchCriteria.java)
*   Data transfer object aggregating all user-specified criteria for library searches.
*   Stores user geographic coordinates (lat, lng), max search radius (default 10 km), targeted competitive exam, and max monthly budget.
*   Contains collections of required amenities (e.g., AC, WiFi, Power Socket, Girls Only Section) and preferred sorting orders.
*   Passed between controllers, search services, and repositories as a clean parameter container.

---

## 7. Backend: Booking, Locking, Cancellation & Top-Ups

### [`BookingController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/BookingController.java)
*   REST controller exposing core seat reservation and checkout endpoints for students.
*   Provides `POST /api/v1/resources/lock` to acquire temporary 7-minute concurrency holds on seats or lockers.
*   Provides `POST /api/v1/bookings/checkout` to validate acquired locks, verify payment nonces, finalize bookings, and return booking references.
*   Translates lock conflict exceptions into HTTP 409 Conflict responses informing users that a seat was just selected by someone else.

### [`BookingService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/BookingService.java)
*   The primary transactional booking service orchestrating complete reservation lifecycles.
*   Verifies that Redis lock tokens for seats and optional lockers are valid and belong to the calling student.
*   Calculates total booking amounts based on shift pricing tiers and locker fee policies, supporting sandbox payment nonce validation.
*   Inserts the `bookings` record, updates seat/locker statuses to `BOOKED`, broadcasts real-time WebSocket state changes, releases Redis keys, and writes ledger entries.

### [`CancellationController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/CancellationController.java)
*   REST controller managing booking cancellations and disputes under PRD Module 19.
*   Exposes `POST /api/v1/bookings/{id}/cancel` allowing students, owners, or staff members to initiate a cancellation.
*   Exposes dispute raising endpoints `POST /api/v1/bookings/{id}/dispute` when students contest unexpected booking cancellations.
*   Verifies user authorization and extracts caller role credentials before delegating cancellation processing to `CancellationService`.

### [`CancellationService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/CancellationService.java)
*   Comprehensive cancellation engine enforcing time-tiered refund policies from `cancellation_refund_tiers`.
*   Records the server-authoritative actor who initiated the cancellation to maintain auditability during disputes.
*   Calculates refund percentages (100% for ≥48h, 75% for 24–48h, 50% for 6–24h, 0% for <6h before shift start).
*   Credits student wallets (`student_wallets`), marks bookings as `CANCELLED`, frees seat desks to `AVAILABLE`, and triggers WebSocket status broadcasts.

### [`CheckoutRequest.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/CheckoutRequest.java)
*   Request DTO submitted by the frontend during booking finalization at `POST /api/v1/bookings/checkout`.
*   Contains the acquired `seatLockToken`, optional `lockerLockToken`, library UUID, shift UUID, and pass type (`HOURLY`, `DAILY`, `WEEKLY`, `MONTHLY`).
*   Includes the payment method string and test payment nonce used to simulate gateway transaction confirmation.
*   Validated with standard validation constraints to ensure no required reservation tokens are missing.

### [`DisputeService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/DisputeService.java)
*   Service handling booking cancellation disputes and anti-fraud resolution according to PRD Module 19.
*   Logs disputes in `booking_disputes`, comparing the student's claimed cancellation actor against the server-recorded cancellation metadata.
*   Automatically rejects disputes where server logs prove the student initiated the cancellation themselves.
*   Escalates legitimate discrepancies (such as unauthorized owner cancellations) to human staff or admin queues for manual review and refund adjustments.

### [`LockReconciliationJob.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/LockReconciliationJob.java)
*   A scheduled background reconciliation task executing every 30 seconds via Spring's `@Scheduled`.
*   Scans database tables for seats or lockers stuck in `LOCKED` status whose corresponding Redis lock keys have naturally expired.
*   Reverts orphaned locked resources back to `AVAILABLE` status in the PostgreSQL database.
*   Publishes WebSocket broadcast updates to all active seat map viewers so abandoned seats visually reopen without page reloads.

### [`LockResourceRequest.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/LockResourceRequest.java)
*   Request DTO for acquiring a temporary resource lock at `POST /api/v1/resources/lock`.
*   Contains the resource type (`SEAT` or `LOCKER`), the resource UUID, library UUID, and selected shift UUID.
*   Validated to prevent empty or malformed resource identifiers from hitting the Redis locking service.
*   Enables the backend to establish clean distributed lock keys formatted as `lock:{type}:{resourceId}`.

### [`OwnerConfirmationJob.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/OwnerConfirmationJob.java)
*   Scheduled cron job executing every 60 seconds implementing temporary booking confirmations (PRD Module 18).
*   Identifies bookings whose owner confirmation status is `PENDING` and whose confirmation deadline has passed.
*   Automatically transitions unconfirmed bookings to `AUTO_CONFIRMED`, guaranteeing that unresponsive owners do not leave students in limbo.
*   Triggers notifications and logs audit records whenever an automatic booking confirmation takes place.

### [`OwnerFacingBookingView.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/OwnerFacingBookingView.java)
*   Data projection record masking sensitive student information when library owners view active bookings.
*   Displays masked student names, masked phone numbers, assigned seat codes, locker numbers, and shift timings.
*   Hides raw student identity data (such as Aadhaar numbers and private billing records) to protect student privacy.
*   Provides owner portals with all operational details required to manage on-premise check-ins without compromising compliance.

### [`PassType.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/PassType.java)
*   Enumeration declaring the standard booking pass durations supported across the EduGlobin platform.
*   Defines four distinct intervals: `HOURLY`, `DAILY`, `WEEKLY`, and `MONTHLY`.
*   Directly drives pricing duration calculations for both seat reservations and tiered locker rentals.
*   Ensures consistent duration handling across database check constraints, REST payloads, and frontend UI selectors.

### [`ResourceLockService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/ResourceLockService.java)
*   The distributed locking engine utilizing Redis via Spring's `StringRedisTemplate`.
*   Executes atomic `SETNX` operations with a 420-second (7-minute) Time-To-Live (TTL) to acquire temporary locks on seats and lockers.
*   Generates cryptographically unique lock tokens returned to the acquiring client to prevent lock hijacking.
*   Implements safe lock releases using an atomic Lua script (`if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`) ensuring users can only release their own active locks.

### [`SeatStatusBroadcaster.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/SeatStatusBroadcaster.java)
*   Real-time event broadcasting service utilizing Spring's `SimpMessagingTemplate`.
*   Publishes seat and locker status change events to STOMP topic destinations: `/topic/library/{libraryId}/seats`.
*   Transmits structured payloads containing resource type (`SEAT` or `LOCKER`), resource ID, new status (`AVAILABLE`, `LOCKED`, `BOOKED`, `IN_USE`), and timestamp.
*   Ensures that every student browsing a library's seat map receives instant visual feedback when any desk is locked or booked.

### [`TopUpRequest.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/TopUpRequest.java)
*   Request DTO submitted by library owners or staff when extending an active student study session (PRD Module 11).
*   Contains the target booking UUID, the requested additional hours or extension duration, and payment mode (`CASH` or `UPI_QR`).
*   Captures the payment amount collected for the incremental extension.
*   Passed to `WalkInService` to process session extensions and record cashier audit logs.

### [`WalkInController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/WalkInController.java)
*   REST controller exposing endpoints for handling walk-in students arriving at libraries without prior online bookings.
*   Provides `POST /api/v1/owner/walk-in` for registering new on-the-spot student entries.
*   Provides `POST /api/v1/owner/walk-in/top-up` for applying session extensions and recording cash or UPI collections.
*   Includes simulation webhook endpoints (`POST /api/v1/owner/walk-in/simulate-upi-webhook`) for verifying QR code payment workflows in test environments.

### [`WalkInRequest.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/WalkInRequest.java)
*   Request DTO capturing walk-in student registration details submitted by library staff.
*   Includes student full name, contact phone number, selected seat desk UUID, shift UUID, pass duration, and optional locker selection.
*   Specifies the payment channel chosen by the student at the counter (`CASH` or `UPI_QR`).
*   Enforces input validation to ensure valid contact numbers and seat selections prior to account provisioning.

### [`WalkInService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/WalkInService.java)
*   Transactional service managing the complete walk-in workflow for offline students arriving at a library desk.
*   Automatically checks or provisions shadow user accounts in Supabase Auth and `profiles` using the student's mobile number.
*   For cash payments, immediately commits the booking in `IN_USE` status and logs the cash transaction to the library coins ledger.
*   For UPI payments, generates dynamic UPI deep-links (`upi://pay?...`), holding the seat in `BOOKED` status until payment confirmation webhooks arrive.

---

## 8. Backend: Modular Placeholders (CRM, Complaints, Gamification)

### [`ComplaintPlaceholder.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/complaint/ComplaintPlaceholder.java)
*   Package documentation and architecture placeholder establishing the structure for the upcoming Student Complaint Ticket module.
*   Outlines planned service boundaries for filing complaint tickets, assigning priority SLAs, tracking owner resolution notes, and escalating to platform support.
*   Ensures the `com.eduglobin.complaint` package is structured and ready for future sprint developments without introducing packaging discrepancies.
*   Maintains consistent architecture across all designated PRD domain modules.

### [`CrmPlaceholder.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/crm/CrmPlaceholder.java)
*   Package placeholder defining the boundary for the Library Owner CRM & Student Register module.
*   Specifies responsibilities for Aadhaar hashing (SHA-256 with no raw storage), offline fee collection, advance/pending balance tracking, and vacating students.
*   Prepares the backend codebase for implementing owner-specific financial reporting and student ledger management.
*   Preserves clear domain separation between public student booking engines and private owner ERP tools.

### [`GamificationPlaceholder.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/gamification/GamificationPlaceholder.java)
*   Package placeholder designating the future home for the Student Study Points and Library Loyalty Coins engine.
*   Documents transaction schemas for rewarding students who maintain high check-in punctuality and study streaks.
*   Outlines ledger tracking for library promotional coins used to boost visibility in search results.
*   Guarantees that upcoming gamification features integrate seamlessly with the existing `points_coins_ledger` table.

---

## 9. Backend: Automated Test Suite

### [`EduGlobinApplicationTests.java`](file:///e:/EduGlobin/backend/src/test/java/com/eduglobin/EduGlobinApplicationTests.java)
*   The primary Spring Boot integration smoke test verifying that the application context loads successfully.
*   Uses `@SpringBootTest` configured with test profile overrides to validate that dependency injection wiring is free of cyclic dependencies or missing beans.
*   Supplies `@MockBean` definitions for `StringRedisTemplate` and `SimpMessagingTemplate` so test suites run cleanly in environments lacking live Redis instances.
*   Serves as the frontline continuous integration guard preventing broken context configurations from being merged.

### [`CancellationServiceTest.java`](file:///e:/EduGlobin/backend/src/test/java/com/eduglobin/backend/src/test/java/com/eduglobin/booking/CancellationServiceTest.java)
*   Unit test suite verifying the business logic of the booking cancellation engine.
*   Tests time-tiered refund percentage calculations across boundary conditions (48 hours, 24 hours, 6 hours, and immediately before shift start).
*   Validates that cancellations record authoritative actor identities, adjust student wallet balances accurately, and release seat/locker allocations.
*   Verifies that attempts to cancel nonexistent or already cancelled bookings throw appropriate `EduGlobinException` errors.

### [`DisputeServiceTest.java`](file:///e:/EduGlobin/backend/src/test/java/com/eduglobin/backend/src/test/java/com/eduglobin/booking/DisputeServiceTest.java)
*   Unit tests validating fraud prevention and booking dispute resolution workflows.
*   Tests automated rejection scenarios where server-side actor logs prove the disputing student initiated the cancellation themselves.
*   Tests escalation routines when cancellations were performed unexpectedly by owners or staff, ensuring cases route to admin review queues.
*   Validates audit trail creation and proper status updates across `booking_disputes`.

### [`OwnerFacingBookingViewTest.java`](file:///e:/EduGlobin/backend/src/test/java/com/eduglobin/backend/src/test/java/com/eduglobin/booking/OwnerFacingBookingViewTest.java)
*   Unit tests confirming that student privacy protection rules are strictly enforced in owner-facing views.
*   Verifies that student phone numbers are masked (e.g., displaying only the last 4 digits) and private identifiers are omitted.
*   Ensures that operational fields needed by desk managers (seat codes, check-in timestamps, pass duration) remain intact.
*   Guarantees compliance with privacy specifications defined in the PRD.

### [`ResourceLockServiceTest.java`](file:///e:/EduGlobin/backend/src/test/java/com/eduglobin/backend/src/test/java/com/eduglobin/booking/ResourceLockServiceTest.java)
*   Exhaustive unit test suite covering all paths of the Redis distributed resource locking engine.
*   Tests successful lock acquisitions (verifying key naming conventions `lock:{type}:{id}` and 7-minute TTL application).
*   Tests concurrency conflicts, verifying that attempting to lock an already-held resource returns an empty optional without throwing unhandled errors.
*   Validates Lua-scripted release logic, ensuring matching tokens successfully release locks while mismatched or expired tokens fail safely.

### [`LibraryScoringServiceTest.java`](file:///e:/EduGlobin/backend/src/test/java/com/eduglobin/backend/src/test/java/com/eduglobin/library/LibraryScoringServiceTest.java)
*   Unit tests for the multi-criteria library matching and recommendation scoring algorithm.
*   Tests scoring calculations when students provide full preferences (distance, budget, exams, amenities) ensuring expected relative weighting.
*   Validates fallback scoring behavior when coordinates or budget limits are omitted, verifying that neutral 0.5 coefficients prevent score skewing.
*   Verifies that libraries with matching competitive exam tags and high safety scores rank higher in recommendations.

### [`LockerServiceTest.java`](file:///e:/EduGlobin/backend/src/test/java/com/eduglobin/backend/src/test/java/com/eduglobin/library/LockerServiceTest.java)
*   Unit test suite validating the locker pricing and checkout resolution engine.
*   Verifies that libraries with `FREE_LOCKERS` return a fee of ₹0 across all pass types.
*   Verifies that libraries with `NO_LOCKERS` return null or throw validation errors when locker add-ons are requested.
*   Tests `PAID_MANAGED` mode across hourly, daily, weekly, and monthly pass types, confirming that the correct tiered rate is charged.

### [`PriceChangeServiceTest.java`](file:///e:/EduGlobin/backend/src/test/java/com/eduglobin/backend/src/test/java/com/eduglobin/library/PriceChangeServiceTest.java)
*   Unit tests verifying price-change governance rules and threshold checks.
*   Tests price increases below the configured threshold (e.g., a 10% increase when the threshold is 20%), verifying automatic immediate approval.
*   Tests price increases above the threshold (e.g., a 30% increase), verifying the shift transitions to `PENDING_ADMIN_APPROVAL` without altering live prices.
*   Tests admin approval and rejection routines, verifying that approved prices update shift records while rejected updates clear pending values.

### [`SimpleCountSeatGeneratorTest.java`](file:///e:/EduGlobin/backend/src/test/java/com/eduglobin/backend/src/test/java/com/eduglobin/library/SimpleCountSeatGeneratorTest.java)
*   Unit tests validating simplified seat grid generation from flat count numbers.
*   Tests grid distribution logic for varied counts (e.g., 20 seats distributed across rows of 6 seats), verifying correct row/column indexing.
*   Verifies that generated seat desk codes follow expected naming patterns (A1, A2... D2) without duplicate coordinates.
*   Confirms that default properties (power sockets, layout source flags) are correctly assigned to all generated seats.

---

## 10. Frontend: Tooling, Configuration & Entry Points

### [`package.json`](file:///e:/EduGlobin/frontend/package.json)
*   The npm manifest file defining project dependencies, scripts, and runtime packages for the React 19 client application.
*   Declares core dependencies: React 19, TypeScript, React Router 7, `@supabase/supabase-js`, Lucide React (icons), and STOMP/SockJS client libraries.
*   Specifies build and development scripts: `npm run dev` (starts Vite dev server), `npm run build` (runs `tsc -b` and Vite production bundling), and preview tooling.
*   Maintains strict version alignments to ensure deterministic builds across developer machines and deployment pipelines.

### [`vite.config.ts`](file:///e:/EduGlobin/frontend/vite.config.ts)
*   Configuration file for the Vite build tool and development server.
*   Integrates the `@vitejs/plugin-react` plugin for fast JSX/TSX compilation and React Fast Refresh hot module replacement.
*   Configures local development server proxy rules forwarding `/api` requests to `http://localhost:8080` to prevent CORS issues during development.
*   Optimizes build rollup options, chunking strategies, and CSS asset extraction for rapid production bundle delivery.

### [`tsconfig.json`](file:///e:/EduGlobin/frontend/tsconfig.json) & [`tsconfig.app.json`](file:///e:/EduGlobin/frontend/tsconfig.app.json)
*   TypeScript compiler configuration files enforcing strict type-checking and modern JavaScript module resolution (`NodeNext`/`Bundler`).
*   Specifies JSX factory settings (`react-jsx`), path alias mappings, and library typings (`["ES2022", "DOM", "DOM.Iterable"]`).
*   Loads Vite client typings (`"types": ["vite/client"]`) to support `import.meta.env` environment variable access without TypeScript compilation errors.
*   Disables problematic unused parameter blocks during early sprint phases to allow agile UI prototyping without breaking build scripts.

### [`index.html`](file:///e:/EduGlobin/frontend/index.html)
*   The single-page application HTML entry document loaded by client web browsers.
*   Configures mobile viewport metadata (`width=device-width, initial-scale=1.0`), UTF-8 character encoding, and application title tags.
*   Pre-loads modern typography (Inter and Outfit from Google Fonts) to establish premium visual design aesthetics.
*   Mounts the root React DOM container `<div id="root"></div>` and scripts the main application entry module `/src/main.tsx`.

### [`.env.example`](file:///e:/EduGlobin/frontend/.env.example)
*   Template configuration file for frontend client-side environment variables.
*   Declares public client variables prefixed with `VITE_`, including `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and backend API base URLs.
*   Guides developers in establishing local frontend connection settings that point to their local or cloud Supabase instances.
*   Keeps sensitive production keys separated from version control.

---

## 11. Frontend: Core Contexts, Internationalization & API Clients

### [`main.tsx`](file:///e:/EduGlobin/frontend/src/main.tsx)
*   The primary JavaScript/TypeScript bootstrap file that mounts the React component tree to the DOM.
*   Initializes the `createRoot` container targeting the `root` DOM element inside `index.html`.
*   Imports global stylesheets (`index.css`), modern typography rules, and internationalization configurations (`i18n.ts`).
*   Renders the root application within `React.StrictMode` to detect potential side-effects and deprecations during development.

### [`App.tsx`](file:///e:/EduGlobin/frontend/src/App.tsx)
*   The top-level React component wrapping the entire user interface in essential context providers.
*   Provides the `ThemeProvider` to persist and propagate light and dark theme classes across all child DOM elements.
*   Provides internationalization contexts enabling real-time language toggling between English and Hindi.
*   Renders the React Router `RouterProvider` routing incoming browser URLs to their corresponding page components.

### [`index.css`](file:///e:/EduGlobin/frontend/src/index.css) & [`App.css`](file:///e:/EduGlobin/frontend/src/App.css)
*   Global stylesheets integrating Tailwind CSS utilities and custom design system foundations.
*   Defines the two-tone EduGlobin color palette (navy and royal blue in light mode; crisp white and electric cyan `#00b4ff` in dark mode).
*   Implements smooth background transitions, glassmorphism card surfaces, and glowing hover states for interactive elements.
*   Houses keyframe animations for pulsing seat-lock indicators and custom scrollbar styling across all modern browsers.

### [`router.tsx`](file:///e:/EduGlobin/frontend/src/router.tsx)
*   The central routing table defining all client-side paths using React Router.
*   Maps URL routes: `/` (LandingPage), `/login` (LoginPage), `/auth/callback` (AuthCallbackPage), `/select-role` (RoleSelectPage), `/register-role` (RegisterRolePage), `/search` (SearchPage), `/recommend` (RecommendPage), `/libraries/:id` (LibraryDetailPage), `/student/dashboard` (StudentDashboardPage), and `/admin` (AdminPortalPage).
*   Wraps public and authenticated views inside `RootLayout` to maintain consistent header navigation, theme toggles, and footers.
*   Handles URL route parameters (such as library UUIDs) and provides seamless navigation across the booking flow.

### [`i18n.ts`](file:///e:/EduGlobin/frontend/src/i18n.ts)
*   Internationalization configuration module managing client-side language switching between English (`en`) and Hindi (`hi`).
*   Loads language dictionary files (`locales/en.json` and `locales/hi.json`), providing key-based translation lookups.
*   Detects user language preferences from localStorage or browser settings, falling back cleanly to English if unspecified.
*   Enables instant, in-memory language switching across the entire UI without requiring full browser page reloads.

### [`locales/en.json`](file:///e:/EduGlobin/frontend/src/locales/en.json) & [`locales/hi.json`](file:///e:/EduGlobin/frontend/src/locales/hi.json)
*   Comprehensive JSON translation dictionaries mapping interface strings to English and Hindi equivalents.
*   Contains translations for authentication headers, navigation links, search filters, exam categories, seat statuses, and booking summaries.
*   Supports bilingual UI rendering across student portals, AI recommendation wizards, and administrative review consoles.
*   Guarantees that students and library owners across India can navigate the platform comfortably in their preferred language.

### [`ThemeContext.tsx`](file:///e:/EduGlobin/frontend/src/theme/ThemeContext.tsx)
*   React Context providing reactive theme management (`light` vs. `dark`) across the entire web application.
*   Persists the active theme choice in browser `localStorage` and automatically syncs the `.dark` class onto the root document HTML tag.
*   Exposes a custom `useTheme()` hook providing child components with the current active theme string and a toggle function.
*   Powers the dynamic two-tone brand logo rendering and ensures high-contrast visual accessibility across all pages.

### [`api.ts`](file:///e:/EduGlobin/frontend/src/lib/api.ts)
*   Centralized HTTP client utility wrapping standard `fetch` calls to backend Spring Boot endpoints.
*   Automatically injects the active Supabase JWT Bearer token into the `Authorization` header for authenticated API requests.
*   Handles base URL resolution, query string parameter serialization, and standardized error parsing from backend `ApiResponse` envelopes.
*   Provides type-safe helper methods (`get`, `post`, `put`, `delete`) used by page components to communicate with the backend.

### [`supabase.ts`](file:///e:/EduGlobin/frontend/src/lib/supabase.ts)
*   Initializes and exports the client-side Supabase SDK instance (`supabase`).
*   Configured using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment files.
*   Manages user authentication sessions, OAuth redirects (Google sign-in), password resets, and token persistence in localStorage.
*   Provides the authentication foundation that bridges user logins with backend Spring Security JWT validation.

---

## 12. Frontend: Shared UI Components & Custom Hooks

### [`Navbar.tsx`](file:///e:/EduGlobin/frontend/src/components/Navbar.tsx)
*   The primary application navigation header rendered at the top of every screen via `RootLayout`.
*   Displays the centered EduGlobin brand logo, quick navigation links (Search, AI Solver, Dashboard), and role-specific shortcuts.
*   Houses the interactive controls for switching between Light and Dark mode, as well as the English / Hindi language toggle dropdown.
*   Displays authenticated user profile chips and logout triggers, or renders prominent "Login" action buttons when unauthenticated.

### [`RootLayout.tsx`](file:///e:/EduGlobin/frontend/src/components/RootLayout.tsx)
*   The master layout component wrapping all routed page views within React Router's `<Outlet />`.
*   Maintains consistent sticky top navigation via `Navbar` and renders a clean, informative footer with copyright and help links.
*   Applies base background color gradients that transition smoothly between light mode (slate-50) and dark mode (slate-950).
*   Guarantees that page transitions occur seamlessly without jarring layout shifts or redundant navbar re-mounting.

### [`LibraryMap.tsx`](file:///e:/EduGlobin/frontend/src/components/LibraryMap.tsx)
*   Interactive map display component rendering library locations on a visual canvas.
*   Plots geographic pins corresponding to search result candidates, highlighting distance in kilometers from the student's pinned location.
*   Supports interactive pin clicks that preview library cards with photo thumbnails, ratings, and instant booking navigation buttons.
*   Provides fallback visual cards when map rendering scripts are disabled or operating in offline environments.

### [`LocationPicker.tsx`](file:///e:/EduGlobin/frontend/src/components/LocationPicker.tsx)
*   Autocomplete location selection input component utilizing the backend LGD location search API.
*   Provides real-time debounced text querying as users type village, tehsil, or district names.
*   Displays dropdown suggestions highlighting featured educational hubs (e.g., Indore Bhawarkua, Kota Talwandi) with distinctive badges.
*   On selection, extracts latitude and longitude coordinates and fires callback events to update the parent search filter state.

### [`SeatGrid.tsx`](file:///e:/EduGlobin/frontend/src/components/SeatMap/SeatGrid.tsx)
*   The core interactive seat map component rendering a visual desk layout from row and column coordinates.
*   Applies distinct, color-coded visual styles based on real-time desk status: `AVAILABLE` (green), `LOCKED` (pulsing amber), `BOOKED` (blue), `IN_USE` (red), and `MAINTENANCE` (slate grey).
*   Renders an indigo ring around the student's currently locked seat selection and displays desk properties (power socket, girls-only indicators).
*   Renders locker inventory cards below the seat grid, displaying tiered rental fees and offering quick add-on toggles.

### [`useSeatMapUpdates.ts`](file:///e:/EduGlobin/frontend/src/hooks/useSeatMapUpdates.ts)
*   Custom React hook providing resilient real-time seat update transport for the seat booking interface.
*   Attempts to establish a high-speed STOMP-over-SockJS WebSocket connection to `/ws`, subscribing to `/topic/library/{id}/seats`.
*   If the WebSocket connection fails or does not connect within 2 seconds, silently and automatically falls back to 3-second HTTP polling of the seats API.
*   Dispatches incoming seat status events through a single unified callback, shielding UI components from low-level networking complexities.

---

## 13. Frontend: User-Facing Pages & Routes

### [`LandingPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/LandingPage.tsx)
*   The primary promotional and marketing landing page welcoming visitors to EduGlobin.
*   Features a hero section with the two-tone EduGlobin branding, value proposition headlines, and quick search call-to-action buttons.
*   Showcases core platform features: AI-driven library matching, real-time interactive seat booking, girls' safety ratings, and locker facilities.
*   Includes educational hub spotlights (Indore, Kota, Delhi) directing students to popular study destinations with a single click.

### [`LoginPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/LoginPage.tsx)
*   The comprehensive authentication portal handling user sign-in and account registration.
*   Supports role-specific sign-in tabs (Student vs. Library Owner) and provides both standard email/password authentication and Google OAuth.
*   Features the centered brand logo ([`logov1.png`](file:///e:/EduGlobin/frontend/public/logov1.png)) with two-tone styling and integrated language/theme switchers.
*   Validates form inputs and communicates with Supabase Auth, redirecting users to callback handlers upon successful credential verification.

### [`AuthCallbackPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/AuthCallbackPage.tsx)
*   OAuth redirection router intercepting access tokens and URL hashes returned by Supabase after Google authentication.
*   Synchronizes authenticated user profiles with the backend relational database, creating profile rows on first-time logins.
*   Calls the backend `/api/v1/me` endpoint to verify the user's registered role and account status.
*   Directs users to role-specific destinations (e.g., student search, owner management consoles, or initial role registration screens).

### [`RoleSelectPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/RoleSelectPage.tsx)
*   Onboarding screen presented to new users who sign up via third-party OAuth providers without a pre-assigned role.
*   Displays interactive visual cards allowing users to choose their identity: "Student / Aspirant" or "Library Owner / Manager".
*   Explains the capabilities and workflow associated with each role to help users make the correct selection.
*   Submits the chosen role selection to the backend profile API and transitions the user into the appropriate registration flow.

### [`RegisterRolePage.tsx`](file:///e:/EduGlobin/frontend/src/pages/RegisterRolePage.tsx)
*   Profile completion screen collecting supplementary user details based on their selected role.
*   For students, collects target competitive exams (UPSC, JEE, NEET, Banking), current academic year, and preferred study timings.
*   For library owners, gathers business operating details, contact numbers, and commercial establishment licenses.
*   Saves the completed profile to PostgreSQL, completing the onboarding workflow before redirecting to the main platform.

### [`SearchPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/SearchPage.tsx)
*   The primary manual library search interface allowing students to discover and filter study spaces.
*   Integrates the `LocationPicker` component to set search centers and provides intuitive filter pills for budget, AC, WiFi, and girls-only sections.
*   Renders responsive search result cards displaying photo thumbnails, distance in km, pricing, and match highlight tags.
*   Provides "Book Desk" action buttons that transition students directly into the live seat map at `/libraries/:id`.

### [`RecommendPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/RecommendPage.tsx)
*   An intelligent, multi-step "AI Solver" recommendation wizard guiding students to optimal libraries.
*   Presents a friendly step-by-step questionnaire capturing target exams, daily study hours, quietness priorities, and budget preferences.
*   Submits criteria to `LibrarySearchService`, evaluating weighted multi-factor match algorithms to score libraries.
*   Presents the top recommendations ranked by match percentage (e.g., "98% Match for your UPSC preparation") with detailed score breakdowns.

### [`LibraryDetailPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/LibraryDetailPage.tsx)
*   The primary desk reservation and booking checkout experience page located at `/libraries/:id`.
*   Features a sticky status header with a live 7-minute countdown timer tracking temporary seat holds.
*   Includes operational shift selectors and pass duration toggles (`HOURLY`, `DAILY`, `WEEKLY`, `MONTHLY`) with dynamic pricing estimates.
*   Embeds the real-time `SeatGrid` component, locker add-on selectors, checkout fee summary panels, and test payment triggers.

### [`StudentDashboardPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/StudentDashboardPage.tsx)
*   The student's personal account hub displaying active reservations, past booking histories, and profile settings.
*   Renders active booking pass cards complete with dynamic check-in QR codes, assigned seat numbers, and valid-until expiration times.
*   Includes quick action triggers allowing students to request session extensions (top-ups) or initiate cancellations.
*   Displays student wallet balances (`student_wallets`) showing available refund credits and settlement records.

### [`AdminPortalPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/AdminPortalPage.tsx)
*   Administrative management console reserved for users authenticated with `ROLE_SUPER_ADMIN`.
*   Provides review queues for pending library onboarding submissions, allowing admins to inspect layouts, view KYC documents, and approve or reject listings.
*   Features price-change governance dashboards displaying requested shift price hikes that exceed configured platform thresholds.
*   Provides dispute escalation review panels where administrators can investigate contested cancellations and issue manual refund adjustments.

---

## 14. Sprint Documentation & Walkthrough Logs

### [`system_documentation.md`](file:///e:/EduGlobin/docs/system_documentation.md)
*   Detailed technical architecture manual recording developmental milestones across Days 1, 2, 2.5, and 3.
*   Catalogs newly created and modified files alongside an entity-relationship (ER) diagram illustrating database table associations.
*   Documents end-to-end operational flows including Owner Onboarding, Locker Add-ons, Walk-In Checkouts, and Redis Locking architectures.
*   Explains system concurrency guarantees, detailing how atomic Redis `SETNX` commands eliminate race conditions and double-bookings.

### [`walkthrough.md`](file:///e:/EduGlobin/docs/walkthrough.md)
*   Verification and testing report documenting build outcomes and test suite executions.
*   Records verification outcomes for Day 2 LGD search seeding, lazy geocoding algorithms, and PRD Addendum v2.5 features.
*   Summarizes backend test executions (`.\gradlew.bat test`), reporting passing outcomes across all unit test classes.
*   Details frontend TypeScript production compilation results (`npm run build`), confirming clean builds with zero errors or warnings.

### [`day1_summary.md`](file:///e:/EduGlobin/day1_summary.md)
*   Historical sprint summary document chronicling the foundational developments completed during Day 1.
*   Documents the initial PostgreSQL database wipe and single-baseline schema migration (`V1__init_schema.sql`).
*   Details Super Admin account seeding, Supabase OAuth synchronization, and the initial bilingual/theme context implementation.
*   Maintains the initial sprint roadmap outlining planned transitions into Day 2 geosearch and library management features.
