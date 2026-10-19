# Narrative Lens — Backend Setup & Deployment Guide

Follow these steps to configure, deploy, and wire up your new FastAPI backend.

---

## 1. Local Environment Configuration

### Apply the signal metadata migration

Before running a new analysis, open the Supabase SQL Editor and run the contents of
`supabase/migrations/20260830010000_add_signal_evidence_metadata.sql`. The backend
now writes evidence counts, analysis status/method, extraction quality, and nullable
scores so it can distinguish a measured zero from unavailable evidence.

Create a file named `.env` inside your `backend/` directory:

```env
PORT=8000
SUPABASE_URL=https://lnycmvscjimmdritmoul.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### How to get these values:
1. **`SUPABASE_SERVICE_KEY`**: Go to your Supabase Dashboard -> **Project Settings** -> **API**. Under *Project API Keys*, copy the `service_role` key (do NOT copy the public/anon key).
2. **`GROQ_API_KEY`**: Create a key in the Groq console. The backend uses Groq, not Gemini.
3. **`SUPABASE_URL`**: Keep the URL above, or copy it from your Supabase API settings page.

---

## 2. How to Run Everything Locally

You can run both the frontend and backend entirely on your system to test and verify everything.

### Step 1: Start the Backend
1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Activate your virtual environment and install dependencies:
   ```bash
   # Windows:
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Start the FastAPI server using Uvicorn:
   ```bash
   python main.py
   ```
   The backend will start running locally at `http://localhost:8000`.

### Step 2: Start the Frontend
1. Open a second terminal window.
2. In the project root, run the frontend dev server:
   ```bash
   bun run dev
   ```
   The frontend runs at `http://localhost:8080`.

Because of the Vite proxy configuration I added in `vite.config.ts`, any client-side request to `/api/*` (including fetching event bundles and triggering re-analysis) will automatically be forwarded to your local backend at `http://localhost:8000`.

---

## 2. Hosting Options

### Option A: Railway (Recommended 🚀)
Railway automatically detects the `Dockerfile` inside the `backend/` directory and builds/deploys it instantly.

1. Create a free account at [Railway.app](https://railway.app/).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select your repository. 
4. In the settings, change the **Root Directory** to `backend` (so it only builds the backend folder).
5. Go to the **Variables** tab for the service and add your env variables:
   * `SUPABASE_URL`
   * `SUPABASE_SERVICE_KEY`
   * `GROQ_API_KEY`
6. Go to **Settings** -> **Generate Domain** to get a public URL (e.g., `https://backend-production.up.railway.app`).

---

### Option B: Render (Good Free Tier ☁️)
Render also supports Dockerfiles natively.

1. Sign up at [Render.com](https://render.com/).
2. Click **New** -> **Web Service**.
3. Connect your GitHub repository.
4. Set the following config:
   * **Runtime**: `Docker`
   * **Docker Build Context**: `backend`
   * **Dockerfile Path**: `Dockerfile`
5. Click **Advanced** -> Add the environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GROQ_API_KEY`).
6. Click **Deploy**. Render will generate a public URL.

---

### Can I host on Vercel?
**Yes, but it is not recommended for this setup.** 
FastAPI can run on Vercel, but Vercel requires configuring serverless functions using a custom `vercel.json` routing configuration and restructuring your code into an `api/` directory. Since this codebase already comes with a standard `Dockerfile` and a `backend/` folder, using **Railway** or **Render** is much simpler (takes ~2 minutes with zero code changes).

---

## 3. Manual Wiring (Frontend Connection)

Once your backend is deployed and you have a live URL:

### Step 1: Connect the Re-Analysis button (Edge Function)
1. Go to your **Supabase Dashboard** -> **Edge Functions** -> click **analyze-article**.
2. Click **Secrets** -> **Add Secret**.
3. Key: `BACKEND_URL`, Value: `https://your-deployed-backend-url.com` (your Railway or Render URL).

---

### Step 2: Switch the Dashboard Read path
When you are ready to fetch data via the API instead of querying Supabase directly, open [`src/routes/_authenticated/dashboard.$eventId.tsx`](file:///c:/Users/Nilima/Desktop/lens-media/src/routes/_authenticated/dashboard.$eventId.tsx) and change line 52:

```typescript
// Find this block (around line 50):
const { data, isLoading, error } = useQuery({
  queryKey: ["event-bundle", eventId],
  queryFn: () => fetchEventBundle(eventId), // <-- CHANGE THIS
});

// Change it to:
const { data, isLoading, error } = useQuery({
  queryKey: ["event-bundle", eventId],
  queryFn: () => fetchEventBundleFromApi(eventId), // <-- TO THIS
});
```
