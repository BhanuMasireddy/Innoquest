# HackTrack - QR Attendance System

## Overview

HackTrack is a production-ready, full-stack Hackathon QR Attendance System designed for event check-ins. The application enables volunteers and admins to scan participant QR codes for entry tracking, view real-time attendance statistics, and manage participant data through a modern cyberpunk-themed interface.

The system follows a monorepo architecture with a React frontend and Express backend, using PostgreSQL for data persistence and custom email/password authentication with bcrypt.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **2026-02-04**: Added attendance status page showing checked-in and not-checked-in participants/volunteers
- **2026-02-04**: Added volunteer profile management with phone, bio, organization fields
- **2026-02-04**: Added admin checkout functionality for participants and volunteers
- **2026-02-04**: Added volunteer QR code generation and tracking for attendance
- **2026-02-04**: Replaced Replit Auth with custom email/password authentication using bcrypt
- **2026-02-04**: Added team management with admin-only CRUD operations
- **2026-02-04**: Added participant management with downloadable QR codes for ID cards

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
- **Authentication**: Custom email/password with bcrypt password hashing

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod integration for schema validation
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Drizzle Kit with `db:push` command

### Database Schema
1. **users** - User accounts with email/password auth, roles (admin/volunteer), profile fields (phone, bio, organization), and volunteer check-in tracking (qrCodeHash, isCheckedIn, lastCheckIn)
2. **sessions** - Session storage for authentication
3. **teams** - Hackathon teams created by admin
4. **participants** - Hackathon attendees linked to teams with QR code hashes and check-in status
5. **scan_logs** - Audit trail of all QR scans with timestamps

### Key Design Decisions

**Monorepo Structure**: Client code lives in `/client`, server in `/server`, shared types in `/shared`. This enables type sharing between frontend and backend.

**Authentication Strategy**: Custom email/password authentication with bcrypt (10 salt rounds). Sessions are stored in PostgreSQL. Admin user is seeded on startup.

**Role-Based Access Control**: 
- Admin: Full access to team/participant/volunteer management, checkout functionality
- Volunteer: Can view attendance, scan QR codes, update own profile

**API Pattern**: All protected routes use `isAuthenticated` middleware. Admin-only routes additionally use `isAdmin` middleware.

**Build Process**: Custom build script in `/script/build.ts` uses esbuild for server bundling and Vite for client bundling. Production assets output to `/dist`.

## Pages

- **/** - Landing page (unauthenticated) or Dashboard (authenticated)
- **/login** - Login page
- **/signup** - Signup page (creates volunteer accounts)
- **/dashboard** - Main dashboard with stats, team/participant management
- **/scanner** - QR code scanner for check-ins
- **/attendance** - View checked-in and not-checked-in participants/volunteers
- **/profile** - User profile page to update personal information

## Admin Account

- **Email**: bhanureddym7@gmail.com
- **Password**: admin123 (should be changed in production)

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new volunteer
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/user` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Teams (Admin only for create/delete)
- `GET /api/teams` - List all teams
- `POST /api/teams` - Create team
- `DELETE /api/teams/:id` - Delete team

### Participants
- `GET /api/participants` - List all participants
- `POST /api/participants` - Create participant (admin only)
- `DELETE /api/participants/:id` - Delete participant (admin only)
- `POST /api/participants/:id/checkout` - Checkout participant (admin only)
- `GET /api/participants/:id/qrcode` - Download QR code PNG (admin only)

### Volunteers
- `GET /api/volunteers` - List volunteers (admin gets full data, others get limited view)
- `POST /api/volunteers/:id/generate-qr` - Generate QR for volunteer (admin only)
- `GET /api/volunteers/:id/qrcode` - Download volunteer QR code (admin only)
- `POST /api/volunteers/:id/checkout` - Checkout volunteer (admin only)

### Scanning
- `POST /api/scan` - Scan QR code (works for both participants and volunteers)
- `GET /api/scans/recent` - Get recent scans

### Stats
- `GET /api/stats` - Get attendance statistics

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database queries and schema management

### Authentication
- **bcrypt**: Password hashing with 10 salt rounds
- **Required Environment Variables**:
  - `DATABASE_URL` - PostgreSQL connection string
  - `SESSION_SECRET` - Secret for session encryption

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
