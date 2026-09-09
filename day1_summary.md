# EduGlobin — Day 1 Build Summary

This document summarizes the development work completed on **Day 1** of the EduGlobin sprint. It details the system architecture setup, database configuration, design system integration, visual assets matching your mockup, and plans for the next phases.

---

## 🚀 Accomplishments

### 1. Database & Schema Migration
- Wiped the existing PostgreSQL instance and re-migrated the **complete database schema** in one single migration.
- Populated tables for profiles, libraries, shifts, seats, lockers, bookings, crm, complaints, and audit logs.
- Added database constraints to prevent invalid sign-ups (e.g. `profiles.auth_provider` check constraint).

### 2. Authentication & Admin Seeding
- Seeded the **Super Admin account** (`admin@eduglobin.com`) directly into Supabase Auth with secure hashing.
- Configured a re-runnable Spring Boot runner that checks if the admin exists and safely bootstraps it.

### 3. Visual & Theme Overhaul (Mockup Alignment)
- Integrated the official **EduGlobin brand logo** ([`logov1.png`](file:///e:/EduGlobin/frontend/public/logov1.png)) centered and scaled at a prominent size (`h-24`).
- Reduced vertical spacing between the logo and the main heading.
- Implemented **two-tone heading style** with customized colors:
  - **Light Theme:** **"Edu"** in navy, **"Globin"** in royal blue with an orange-dotted **"i"**.
  - **Dark Theme:** **"Edu"** in white, **"Globin"** in electric cyan-blue (`#00b4ff`) with an orange-dotted **"i"**.
  - **Tagline side dividers:** Slate lines in light mode, cyan-blue lines in dark mode.
- Wrapped the application in a custom context supporting **Light & Dark Mode** and **Bilingual Translations (English / Hindi)**.

### 4. Google OAuth Redirection & Sync
- Implemented Google OAuth flow for **Student** and **Library Owner** accounts.
- Created a callback router page ([`AuthCallbackPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/AuthCallbackPage.tsx)) that synchronizes authentication profiles to the relational PostgreSQL database upon first-time login.
- Validated role permissions against the Spring Boot resource server API (`/api/v1/me`) to block unauthorized cross-role logins.

---

## 📂 File Registry & Future Roles

The table below lists all files created or modified, their current responsibilities, and their future roles in the upcoming days of the sprint:

| File Name | Current Responsibility | Future Role |
| :--- | :--- | :--- |
| [`V1__init_schema.sql`](file:///e:/EduGlobin/backend/src/main/resources/db/migration/V1__init_schema.sql) | Bootstraps the full PostgreSQL schema. | Stays as the baseline schema container. Newer updates will use incremental migrations. |
| [`application.yml`](file:///e:/EduGlobin/backend/src/main/resources/application.yml) | Configures JWT signatures (ES256), disables local Redis actuator checks, and specifies CORS endpoints. | Will house Redis connection details and geosearch boundaries. |
| [`AdminSeedRunner.java`](file:///e:/EduGlobin/backend/src/main/java/com\eduglobin\auth\AdminSeedRunner.java) | Safely seeds the Super Admin database row. | Can be extended to seed dummy data for shifts/libraries for staging environments. |
| [`LoginPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/LoginPage.tsx) | Handles credentials input, tab selections, Google OAuth triggers, and bilingual/theme switching. | Stays as the gatekeeper for user authentication. |
| [`AuthCallbackPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/AuthCallbackPage.tsx) | Intercepts Supabase OAuth redirection tokens and synchronizes profile rows. | Will handle role-based dashboard landing redirection. |
| [`ThemeContext.tsx`](file:///e:/EduGlobin/frontend/src/theme/ThemeContext.tsx) | Persists and toggles the light/dark theme class on the document root. | Will provide theme colors to dynamic elements like chart visuals. |
| [`index.css`](file:///e:/EduGlobin/frontend/src/index.css) | Configures Tailwind v4, fonts, and global body background transitions. | Will style custom SVG seat-maps and micro-animations. |

---

## 🔮 Next Steps (Day 2: Library CRUD & Geosearch)
- Create controller endpoints in `com.eduglobin.library` for Library Management.
- Add **PostGIS geometry types** and spatial query logic in PostgreSQL to list libraries sorted by proximity (distance in km) from user coordinates.
