# HackTrack - QR Attendance System

## Overview

HackTrack is a production-ready, full-stack Hackathon QR Attendance System designed for event check-ins. The application enables volunteers and admins to scan participant QR codes for entry tracking, view real-time attendance statistics, and manage participant data through a modern cyberpunk-themed interface.

The system follows a monorepo architecture with a React frontend and Express backend, using PostgreSQL for data persistence and Replit Auth for authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with HMR support
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **UI Theme**: Dark cyberpunk aesthetic with neon purple/blue accents
- **QR Scanning**: html5-qrcode library for camera-based QR code reading

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (compiled with tsx)
- **API Design**: RESTful endpoints under `/api` prefix
- **Session Management**: express-session with PostgreSQL store (connect-pg-simple)
- **Authentication**: Replit Auth via OpenID Connect

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod integration for schema validation
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Drizzle Kit with `db:push` command

### Database Schema
1. **users** - Stores authenticated user information (required for Replit Auth)
2. **sessions** - Session storage for authentication (required for Replit Auth)
3. **profiles** - Extends users with roles (admin/volunteer)
4. **participants** - Hackathon attendees with QR code hashes and check-in status
5. **scan_logs** - Audit trail of all QR scans with timestamps

### Key Design Decisions

**Monorepo Structure**: Client code lives in `/client`, server in `/server`, shared types in `/shared`. This enables type sharing between frontend and backend.

**Authentication Strategy**: Uses Replit Auth (OIDC) instead of custom authentication. The auth flow is handled through `/api/login` and `/api/logout` endpoints with session persistence in PostgreSQL.

**API Pattern**: All protected routes use the `isAuthenticated` middleware. The frontend handles 401 responses by redirecting to login.

**Build Process**: Custom build script in `/script/build.ts` uses esbuild for server bundling and Vite for client bundling. Production assets output to `/dist`.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database queries and schema management

### Authentication
- **Replit Auth**: OIDC-based authentication
- **Required Environment Variables**:
  - `DATABASE_URL` - PostgreSQL connection string
  - `SESSION_SECRET` - Secret for session encryption
  - `ISSUER_URL` - OIDC issuer (defaults to Replit)
  - `REPL_ID` - Replit environment identifier

### Frontend Libraries
- **@tanstack/react-query**: Server state management
- **html5-qrcode**: QR code scanning via device camera
- **lucide-react**: Icon library
- **Radix UI primitives**: Accessible component foundations
- **class-variance-authority**: Component variant styling

### Development Tools
- **Vite**: Frontend dev server and bundler
- **tsx**: TypeScript execution for Node.js
- **Drizzle Kit**: Database migration tooling