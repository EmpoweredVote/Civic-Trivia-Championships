---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false

must_haves:
  truths:
    - "Backend stays awake (no 20-30s cold start for users)"
    - "Frontend stays awake (no 20-30s cold start for users)"
    - "Health endpoint responds 200 for healthy backend"
  artifacts: []
  key_links:
    - from: "UptimeRobot monitor (backend)"
      to: "https://civic-trivia-backend.onrender.com/health"
      via: "HTTP GET every 5 minutes"
    - from: "UptimeRobot monitor (frontend)"
      to: "https://civic-trivia-frontend.onrender.com"
      via: "HTTP GET every 5 minutes"
---

<objective>
Set up UptimeRobot monitors to prevent Render free tier instances from sleeping.

Purpose: Render free tier sleeps after 15 min of inactivity, causing 20-30s wake times for the first user. UptimeRobot pings endpoints every 5 minutes to keep instances alive.
Output: Two UptimeRobot monitors configured and active -- one for backend health endpoint, one for frontend.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Existing health endpoint: `backend/src/routes/health.ts`
- Route: GET /health
- Returns: { status: "healthy", timestamp, uptime, storage: { type, healthy, sessionCount } }
- Returns 503 with status "degraded" if Redis is down
- Mounted at: app.use('/health', healthRouter) in server.ts

Backend URL: https://civic-trivia-backend.onrender.com
Frontend URL: https://civic-trivia-frontend.onrender.com
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify health endpoint is accessible in production</name>
  <files></files>
  <action>
    Run a curl request to confirm the production health endpoint responds correctly:

    ```
    curl -s https://civic-trivia-backend.onrender.com/health | head -c 500
    ```

    Also verify the frontend is reachable:

    ```
    curl -s -o /dev/null -w "%{http_code}" https://civic-trivia-frontend.onrender.com
    ```

    Both should return 200. The health endpoint already exists (backend/src/routes/health.ts)
    so no code changes are needed. If the backend is sleeping, the first request may take
    20-30s -- this is expected and exactly the problem UptimeRobot will solve.

    NO code changes required. The health endpoint is already implemented and deployed.
  </action>
  <verify>curl to /health returns 200 with JSON body containing status field. curl to frontend returns 200.</verify>
  <done>Both production endpoints confirmed accessible and returning 200.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Create UptimeRobot monitors</name>
  <action>
    UptimeRobot is a free external monitoring service. Claude cannot create accounts or
    configure external dashboards. The user must perform these steps.
  </action>
  <instructions>
    1. Go to https://uptimerobot.com and sign up for a free account (or log in)
    2. Click "+ Add New Monitor" to create the BACKEND monitor:
       - Monitor Type: HTTP(s)
       - Friendly Name: Civic Trivia Backend
       - URL: https://civic-trivia-backend.onrender.com/health
       - Monitoring Interval: 5 minutes
       - Click "Create Monitor"
    3. Click "+ Add New Monitor" to create the FRONTEND monitor:
       - Monitor Type: HTTP(s)
       - Friendly Name: Civic Trivia Frontend
       - URL: https://civic-trivia-frontend.onrender.com
       - Monitoring Interval: 5 minutes
       - Click "Create Monitor"
    4. (Optional) Set up alert contacts to get notified if either goes down

    Free tier includes 50 monitors at 5-minute intervals, which is more than enough.

    The 5-minute interval keeps both Render instances awake since they sleep after 15 min
    of inactivity. This means users will never hit the 20-30s cold start delay.
  </instructions>
  <resume-signal>Type "done" after creating both monitors, or describe any issues.</resume-signal>
</task>

</tasks>

<verification>
- Backend health endpoint: `curl https://civic-trivia-backend.onrender.com/health` returns 200
- Frontend: `curl https://civic-trivia-frontend.onrender.com` returns 200
- UptimeRobot dashboard shows both monitors as "Up"
- After 15+ minutes, both services still respond instantly (no cold start)
</verification>

<success_criteria>
- Two UptimeRobot monitors active (backend /health + frontend /)
- Both monitors showing "Up" status
- Render free tier instances no longer sleep due to inactivity
</success_criteria>

<output>
After completion, create `.planning/quick/002-set-up-uptimerobot/002-SUMMARY.md`
</output>
