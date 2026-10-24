# Deployment Guide: Render (Backend) & Vercel (Frontend)

This repository is structured as a monorepo containing:
- `backend/`: Express + TypeScript + Prisma + Neon PostgreSQL API.
- `frontend/`: React + Vite + TypeScript dashboard.

---

## 1. Deploy the Backend on Render

Render hosts the Node.js API server and connects to your Neon PostgreSQL cloud database.

### Step 1: Create a Web Service on Render
1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** → **Web Service**.
2. Connect your GitHub repository (`Major-Project`).

### Step 2: Configure Service Settings
| Field | Value | Notes |
|---|---|---|
| **Name** | `aquaflow-backend` | Or any name you prefer |
| **Region** | Oregon (US West) or Ohio (US East) | Select Ohio (US East) to be closest to your Neon database in `us-east-2` |
| **Branch** | `main` | Default branch |
| **Root Directory** | `backend` | **CRITICAL**: Tells Render your API code is in the `backend` folder |
| **Runtime** | `Node` | |
| **Build Command** | `npm install && npm run build` | Generates Prisma client and compiles TypeScript to `dist` |
| **Start Command** | `npm start` | Runs `node dist/index.js` |
| **Instance Type** | `Free` | |

### Step 3: Add Environment Variables
In the **Environment Variables** section on Render, add:

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:npg_BJlD1quIbC9N@ep-ancient-meadow-b4zbl1o2-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `JWT_SECRET` | `aquaflow_distributor_secret_key_2026` |
| `NODE_ENV` | `production` |

*(Note: Render automatically assigns the `PORT` variable, and the backend binds to it dynamically).*

### Step 4: Deploy & Verify
1. Click **Create Web Service**.
2. Wait 2-3 minutes for the build to finish.
3. Once live, copy your service URL (e.g. `https://aquaflow-backend.onrender.com`).
4. Open `https://aquaflow-backend.onrender.com/` in your browser. You should see:
   ```json
   {
     "status": "online",
     "service": "AquaFlow Packaged Water Distribution API",
     "database": "Neon PostgreSQL Connected",
     "version": "1.0.0"
   }
   ```

---

## 2. Deploy the Frontend on Vercel

Vercel hosts the static React Single Page Application (SPA) with automated edge CDN caching.

### Step 1: Import Project into Vercel
1. Go to [vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Select your GitHub repository (`Major-Project`).

### Step 2: Configure Project Settings
| Setting | Value | Notes |
|---|---|---|
| **Framework Preset** | `Vite` | Auto-detected |
| **Root Directory** | Click **Edit** → select `frontend` | **CRITICAL**: Tells Vercel where the client app is located |
| **Build Command** | `npm run build` | Default |
| **Output Directory** | `dist` | Default |
| **Install Command** | `npm install` | Default |

### Step 3: Add Environment Variable
Under **Environment Variables**, add:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://aquaflow-backend.onrender.com` |

*(Replace `https://aquaflow-backend.onrender.com` with the actual Render backend URL obtained from Part 1).*

### Step 4: Deploy & Verify
1. Click **Deploy**.
2. Vercel will build the Vite bundle and deploy it in under 60 seconds.
3. Open your Vercel deployment URL (e.g. `https://aquaflow-frontend.vercel.app`).
4. Log in with:
   - **Email**: `admin@aquaflow.local`
   - **Password**: `password123`

---

## 3. Important Monorepo Files Included
- [`render.yaml`](file:///Users/samarthkolarkar/Classroom/Major-Project/render.yaml): Render Blueprint for infrastructure-as-code setup.
- [`frontend/vercel.json`](file:///Users/samarthkolarkar/Classroom/Major-Project/frontend/vercel.json): Handles SPA client-side routing rewrites so page refreshes never return 404.
- [`backend/package.json`](file:///Users/samarthkolarkar/Classroom/Major-Project/backend/package.json): Includes `"postinstall": "prisma generate"` and `"build": "prisma generate && tsc"`.
- [`frontend/src/services/api.ts`](file:///Users/samarthkolarkar/Classroom/Major-Project/frontend/src/services/api.ts): Dynamically routes requests to `VITE_API_BASE_URL`.
