# AdvoHQ — Full Stack Setup & Deployment Guide

AdvoHQ is a case and brief management platform for advocates.  
**Backend** → Node.js / Express / PostgreSQL — hosted on **Render**  
**Frontend** → Static HTML/CSS/JS — hosted on **Vercel**

---

## Repository Structure

You need **two separate GitHub repos**:

```
advohq-backend/      ← this folder → GitHub → Render
advohq-frontend/     ← this folder → GitHub → Vercel
```

---

## 1 — Prerequisites

- [Node.js 18+](https://nodejs.org)
- [Git](https://git-scm.com)
- A [GitHub](https://github.com) account
- A [Render](https://render.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works)

---

## 2 — Local Development

### 2a — Backend

```bash
cd advohq-backend
npm install

# Copy and fill in your local .env
cp .env.example .env
# Edit .env — set DATABASE_URL to a local Postgres instance
# e.g. DATABASE_URL=postgresql://postgres:password@localhost:5432/advohq

# Create the database (if using local Postgres)
createdb advohq

# Run migrations
npm run db:migrate

# (Optional) seed demo data
npm run db:seed

# Start dev server with auto-reload
npm run dev
# API is now at http://localhost:4000
```

### 2b — Frontend

```bash
cd advohq-frontend

# Edit config.js — point to your local backend:
#   window.ADVOHQ_API = 'http://localhost:4000';

# Serve with any static server, e.g.:
npx serve .
# or just open index.html directly in your browser
```

---

## 3 — Push to GitHub

### Backend repo

```bash
cd advohq-backend
git init
git add .
git commit -m "Initial commit"
# Create a new repo on GitHub called advohq-backend, then:
git remote add origin https://github.com/YOUR_USERNAME/advohq-backend.git
git branch -M main
git push -u origin main
```

### Frontend repo

```bash
cd advohq-frontend
git init
git add .
git commit -m "Initial commit"
# Create a new repo on GitHub called advohq-frontend, then:
git remote add origin https://github.com/YOUR_USERNAME/advohq-frontend.git
git branch -M main
git push -u origin main
```

---

## 4 — Deploy Backend on Render

### Option A — Blueprint (recommended, one click)

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your `advohq-backend` GitHub repo
3. Render reads `render.yaml` and creates:
   - A **Web Service** (`advohq-api`)
   - A **PostgreSQL database** (`advohq-db`)
4. Click **Apply** — Render builds and deploys automatically
5. After deploy succeeds, go to the Web Service → **Shell** tab and run:
   ```
   npm run db:migrate
   npm run db:seed      # optional — creates demo user
   ```

### Option B — Manual

1. **Create a PostgreSQL database**
   - Render dashboard → **New** → **PostgreSQL**
   - Name: `advohq-db`, Plan: Free → **Create Database**
   - Copy the **Internal Database URL**

2. **Create a Web Service**
   - Render dashboard → **New** → **Web Service**
   - Connect your `advohq-backend` repo
   - Settings:
     | Field | Value |
     |-------|-------|
     | Environment | Node |
     | Build Command | `npm install` |
     | Start Command | `npm start` |
     | Plan | Free |

3. **Set Environment Variables** (in the Web Service → Environment tab):
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | *(paste Internal Database URL from step 1)* |
   | `JWT_SECRET` | *(generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)* |
   | `NODE_ENV` | `production` |
   | `FRONTEND_ORIGIN` | *(leave blank for now — fill after Vercel deploy)* |

4. Click **Create Web Service** → wait for deploy to finish
5. Note your service URL: `https://advohq-api.onrender.com`
6. Run migrations via the Shell tab:
   ```
   npm run db:migrate
   ```

---

## 5 — Deploy Frontend on Vercel

1. **Update `config.js`** with your Render backend URL:
   ```js
   window.ADVOHQ_API = 'https://advohq-api.onrender.com'; // ← your Render URL
   ```
2. Commit and push this change:
   ```bash
   git add config.js
   git commit -m "Set production API URL"
   git push
   ```
3. Go to [vercel.com](https://vercel.com) → **Add New Project**
4. Import your `advohq-frontend` GitHub repo
5. Framework: **Other** (no framework — it's static HTML)
6. Leave all build settings blank → **Deploy**
7. After deploy, note your URL: `https://advohq.vercel.app`

---

## 6 — Connect Frontend ↔ Backend (CORS)

1. Go back to **Render** → your Web Service → **Environment**
2. Set `FRONTEND_ORIGIN` = `https://advohq.vercel.app` (your Vercel URL)
3. Render auto-redeploys with the new env var

Your app is now fully live. ✅

---

## API Reference

All endpoints require `Authorization: Bearer <token>` except `/api/auth/*`.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login → returns `token` + `refresh_token` |
| POST | `/api/auth/refresh` | Rotate access token |
| POST | `/api/auth/logout` | Invalidate refresh token |
| GET  | `/api/auth/me` | Get current user |

### Cases
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/cases` | List cases (`?status=active&q=search`) |
| POST   | `/api/cases` | Create case |
| GET    | `/api/cases/:id` | Get case |
| PUT    | `/api/cases/:id` | Update case |
| PATCH  | `/api/cases/:id/points` | Update argument points array |
| DELETE | `/api/cases/:id` | Delete case |

### Events
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/events` | List events (`?from=&to=&type=&case_id=`) |
| GET    | `/api/events/upcoming` | Events in next 7 days |
| POST   | `/api/events` | Create event |
| PUT    | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Delete event |

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/notifications` | List notifications + `unread_count` |
| GET    | `/api/notifications/count` | Get `unread_count` only |
| PATCH  | `/api/notifications/:id/read` | Mark one read |
| POST   | `/api/notifications/read-all` | Mark all read |
| DELETE | `/api/notifications/:id` | Delete notification |

### Files
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/files?case_id=` | List files for a case |
| POST   | `/api/files` | Register file record |
| GET    | `/api/files/:id` | Get file metadata |
| PATCH  | `/api/files/:id/canvas` | Save annotation canvas data |
| DELETE | `/api/files/:id` | Delete file record |

### Users / Settings
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/users/me` | Get profile |
| PATCH  | `/api/users/me` | Update profile |
| PATCH  | `/api/users/me/password` | Change password |
| PATCH  | `/api/users/me/settings` | Merge settings JSONB |
| DELETE | `/api/users/me` | Delete account |

---

## Database Schema (summary)

```
users         — id, name, email, username, password, role, settings (JSONB)
cases         — id, user_id, title, client, court, case_number, status, points (JSONB), tags
case_files    — id, case_id, user_id, name, size, mime_type, storage_url, canvas_data (JSONB)
events        — id, user_id, case_id, title, type, date, time, location, notes
notifications — id, user_id, title, body, type, read
refresh_tokens— id, user_id, token, expires_at
```

---

## Demo Credentials (after running `npm run db:seed`)

| Field | Value |
|-------|-------|
| Username | `demo` |
| Password | `demo1234` |

---

## Troubleshooting

**"Failed to fetch" in browser**  
→ Check `config.js` has the correct Render URL.  
→ Check `FRONTEND_ORIGIN` on Render matches your Vercel URL exactly (no trailing slash).

**Render service sleeps (free tier)**  
→ Free Render services spin down after 15 min of inactivity. First request takes ~30s to wake up. Upgrade to Starter ($7/mo) to avoid this.

**`DATABASE_URL` connection error on Render**  
→ Make sure you used the **Internal** connection string (not External) when both DB and web service are on Render.

**Migrations fail**  
→ Run `npm run db:migrate` from the Render Shell tab after the DB is provisioned.
