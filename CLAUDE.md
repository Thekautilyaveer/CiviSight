# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CiviSight is a full-stack dashboard for the Association of County Commissioners of Georgia (ACCG) to manage counties, compliance tasks, contacts, and deadline reminders. It's a MERN-style app: React (CRA) frontend + Express/Mongoose backend + MongoDB.

## Commands

Run from the repo root unless noted:

```bash
npm run install-all   # install root + backend + frontend deps
npm run dev           # run backend (port 5001) and frontend (port 3000) together via concurrently
npm run server        # backend only (nodemon)
npm run client        # frontend only (react-scripts)
```

Backend (`cd backend`):
```bash
npm run dev           # nodemon server.js
npm start             # node server.js (production)
node seed.js          # seed users, counties, sample tasks (destructive: clears collections)
node seed-troup-contacts.js   # seed contacts for Troup County
```

Frontend (`cd frontend`):
```bash
npm start             # dev server
npm run build         # production build
npm test              # react-scripts test (Jest + React Testing Library). Run a single test: npm test -- MyComponent
```

There is no backend test runner or linter configured. Frontend lint is CRA's built-in ESLint (`react-app` config).

## Environment

Backend requires a `backend/.env` (see `backend/env.example`). `server.js` **fails fast on startup** if any of these are missing: `JWT_SECRET`, `MONGODB_URI`, `EMAIL_USER`, `EMAIL_PASSWORD`. Other vars: `PORT` (default 5001), `EMAIL_TO` (where reminder emails are sent), `FRONTEND_URL`, optional AWS S3 vars.

Frontend talks to the API via `REACT_APP_API_URL` (defaults to `http://localhost:5001/api`).

Default seeded credentials — admin: `admin@civisight.org` / `admin123`; county user: `county@civisight.org` / `county123`.

## Architecture

### Backend (`backend/`)
- `server.js` — Express app. Mounts routers under `/api/{auth,counties,tasks,notifications,contacts,users}`, serves uploaded files statically at `/api/files`, connects Mongoose, starts the reminder scheduler, and registers global error + 404 handlers last.
- `models/` — Mongoose schemas: `User`, `County`, `Task`, `Contact`, `Notification`. Schemas define their own indexes (see `Task.js` for compound indexes tuned to the query patterns).
- `routes/` — one router per resource. `tasks.js` (~800 lines) holds most domain logic: filtering, file upload endpoints, comments, reminders, and fiscal-year deadline derivation.
- `middleware/auth.js` — `auth` verifies the JWT Bearer token and attaches `req.user` (password stripped); `adminOnly` gates admin routes. Apply both as needed: `router.post('/', auth, adminOnly, ...)`.
- `middleware/upload.js` & `utils/storage.js` — multer-based file uploads to `uploads/forms` and `uploads/filled-forms` (10MB limit; pdf/doc/xls/img/txt). `getSignedUrl`/`deleteFile` abstract storage; despite `aws-sdk`/`multer-s3` deps, **storage is local disk by default**.
- `utils/reminderScheduler.js` — runs on startup and hourly (`setInterval`), emails reminders for non-completed tasks due within 3 days, deduped to one per task per 24h. Reminders always go to `EMAIL_TO`.
- `utils/email.js` — nodemailer (Gmail service). No-ops gracefully if email creds are absent.
- `utils/logger.js` — Winston logger writing to `logs/`. Prefer it over `console.log`.

### Frontend (`frontend/src/`)
- `App.js` — all routes. Pages are wrapped in `<PrivateRoute>` (+ `adminOnly` flag) and `<Layout>`. Admin-only routes: `/create-task`, `/notifications`, `/users`.
- `context/AuthContext.js` — auth state. `login` stores the JWT in `localStorage`; `useAuth()` exposes `user`, `isAuthenticated`, `isAdmin`, `login`, `logout`. `ThemeContext.js` handles dark mode.
- `utils/api.js` — the **single axios instance** all API calls must use. A request interceptor injects the Bearer token; a response interceptor redirects to `/login` and clears the token on any 401.
- `pages/` — `Dashboard`, `CountyDetail`, `CreateTask`, `Contacts`, `FormPilot`, `Notifications`, `Users`, `Login`.

### Cross-cutting: roles & permissions
Two orthogonal concepts — keep them distinct:
1. **Account role** (`User.role`): `admin` | `county_user`. Controls API access (via `adminOnly`) and route visibility (via `PrivateRoute adminOnly`). County users only ever see data for their own `countyId`.
2. **Department roles** (`User.departmentRoles`, `Task.assignedRoles`): a fixed enum in `backend/constants/departmentRoles.js` (mirrored in `frontend/src/constants/departmentRoles.js` — **keep these two in sync**). Used for task visibility/notification filtering: a task with no `assignedRoles` is visible to all county users; otherwise only to users whose `departmentRoles` overlap (a county user with no department roles sees everything). See the query-building in `routes/tasks.js` GET `/` and `usersToNotifyForTask`.

Tasks can derive deadlines from a county's fiscal-year-end (`fiscalYearEndMonth`/`Day` on `County`) plus offsets in `FISCAL_OFFSET_DAYS` (`routes/tasks.js`).

## Conventions
- Backend uses CommonJS (`require`); frontend uses ES modules.
- Styling is Tailwind CSS (config in `frontend/`); no component library.
- Validate request bodies with `express-validator` (`body(...)` + `validationResult`) as existing routes do.
- The `README.md`'s model/endpoint list is partially out of date (it predates the Contact/Users routes, FormPilot, department roles, and the local-storage refactor) — trust the code over the README.
