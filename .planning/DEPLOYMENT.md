# Deployment Documentation

**Status:** LIVE ✅  
**Last Updated:** 2026-02-17  
**Deployed By:** Chris (EmpoweredChris)

---

## Live URLs

- **Frontend:** https://civic-trivia-frontend.onrender.com
- **Backend API:** https://civic-trivia-backend.onrender.com
- **Health Check:** https://civic-trivia-backend.onrender.com/health
- **GitHub Repo:** https://github.com/EmpoweredVote/Civic-Trivia-Championships

---

## Architecture Overview

```
Frontend (Render Static Site)
    ↓ API calls to
Backend (Render Web Service)
    ↓ Connects to
PostgreSQL (Supabase - civic_trivia schema)
Redis (Upstash - session storage)
```

---

## GitHub Organization

**Organization:** EmpoweredVote  
**Repository:** Civic-Trivia-Championships  
**URL:** https://github.com/EmpoweredVote/Civic-Trivia-Championships

**Members:**
- Chris (EmpoweredChris) - Owner
- [Add other volunteers as they join]

**Connected Services:**
- Render (GitHub App installed)
- Netlify (authorized but not currently used)

---

## Render Deployment

**Account:** Personal account (chris@empowered.vote)  
**Dashboard:** https://dashboard.render.com

### Backend Web Service

**Service Name:** civic-trivia-backend  
**Type:** Web Service  
**Region:** Oregon (US West)  
**Instance:** Free tier

**Build Settings:**
- Root Directory: `backend`
- Build Command: `npm install --include=dev && npm run build && cp -r src/data dist/data`
- Start Command: `npm start`

**Environment Variables:**
```
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://civic-trivia-frontend.onrender.com
DATABASE_URL=postgresql://postgres.mzuppdqbibqjedmesbmp:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres?options=--search_path%3Dcivic_trivia
REDIS_URL=rediss://default:[PASSWORD]@stirred-pika-7510.upstash.io:6379
JWT_SECRET=7f91baaeb99aae188678f9f710c5bee0fd67ae2da9e28016a3847a2d3e00794f
JWT_REFRESH_SECRET=cb7fcc878418c82575647d7911314f0ca80fb6a49640e455170c5aed10f5147c
```

**Note:** Passwords are stored in Render environment variables (not shown here for security)

### Frontend Static Site

**Service Name:** civic-trivia-frontend  
**Type:** Static Site  
**Region:** Oregon (US West)  

**Build Settings:**
- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

**Environment Variables:**
```
VITE_API_URL=https://civic-trivia-backend.onrender.com
```

**Important Files:**
- `frontend/.env.production` - Contains VITE_API_URL for production builds
- `frontend/public/_redirects` - Not used (Render static sites don't support redirects)

---

## Supabase Database

**Account:** chris@empowered.vote  
**Project:** EV-Backend-Dev (Development)  
**Dashboard:** https://supabase.com/dashboard

**Connection Details:**
- Host: aws-1-us-east-2.pooler.supabase.com
- Port: 5432
- Database: postgres
- Schema: civic_trivia
- User: postgres.mzuppdqbibqjedmesbmp

**Tables:**
- `civic_trivia.users` - User accounts, progression, profile data

**Schema Location:** `backend/schema.sql`

**Note:** We use a separate `civic_trivia` schema to avoid conflicts with other Empowered.Vote features in the same Supabase project.

---

## Upstash Redis

**Account:** chris@empowered.vote  
**Database:** civic-trivia-redis  
**Dashboard:** https://console.upstash.com

**Connection Details:**
- Host: stirred-pika-7510.upstash.io
- Port: 6379
- TLS: Enabled

**Usage:**
- Session storage (game sessions, user sessions)
- Legacy token storage (refresh tokens)

**Free Tier Limits:**
- 10,000 commands/day
- 256 MB storage

---

## Deployment Workflow

### Automatic Deploys

Render watches the GitHub repo and auto-deploys on push to `master` branch:

1. **Developer pushes to master:**
   ```bash
   git push origin master
   ```

2. **Render automatically:**
   - Detects the push
   - Rebuilds affected services
   - Deploys if build succeeds
   - Shows live logs during deployment

3. **Typical deploy time:**
   - Backend: 2-3 minutes
   - Frontend: 1-2 minutes

### Manual Deploy

**Via Render Dashboard:**
1. Go to service (backend or frontend)
2. Click "Manual Deploy" button
3. Select "Deploy latest commit"

### Viewing Logs

**Live logs:**
1. Go to service in Render dashboard
2. Click "Logs" tab
3. Click "Live tail" to see real-time logs

**Common log messages:**
```
✅ Connected to Redis
PostgreSQL connected
Server running on http://localhost:10000
CORS enabled for: https://civic-trivia-frontend.onrender.com
Storage: Redis
```

---

## Free Tier Limitations

### Render Free Tier

**Backend (Web Service):**
- Goes to sleep after 15 minutes of inactivity
- First request after sleep takes 20-30 seconds to wake up
- 750 hours/month free (enough for continuous uptime)
- Spins down after extended inactivity

**Frontend (Static Site):**
- Always available (no sleep mode)
- Fast delivery via CDN

**Workarounds for sleep mode:**
- Use a service like UptimeRobot to ping the health endpoint every 10 minutes
- Or accept the occasional slow first load

### Supabase Free Tier

- 2 projects maximum (using EV-Backend-Dev)
- 500 MB database storage
- 1 GB file storage
- 2 GB bandwidth/month

### Upstash Free Tier

- 10,000 commands/day
- 256 MB storage
- Usually enough for development/small production

---

## Local Development

### Environment Files

**Backend `.env` (local development):**
```
PORT=3000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:On0mastic0n!@localhost:5433/civic_trivia
REDIS_URL=redis://localhost:6379
JWT_SECRET=7f91baaeb99aae188678f9f710c5bee0fd67ae2da9e28016a3847a2d3e00794f
JWT_REFRESH_SECRET=cb7fcc878418c82575647d7911314f0ca80fb6a49640e455170c5aed10f5147c
```

**Frontend `.env.production` (production builds):**
```
VITE_API_URL=https://civic-trivia-backend.onrender.com
```

### Running Locally

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

**Local URLs:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

---

## Database Management

### Applying Schema Updates

**To Supabase (production):**
1. Go to Supabase SQL Editor
2. Paste contents of `backend/schema.sql`
3. Run the script

**To Local PostgreSQL:**
```bash
cd backend
node update-local-schema.js
```

### Viewing Data

**Supabase:**
1. Dashboard → Table Editor
2. Select `civic_trivia` schema
3. View/edit data in browser

**Local:**
Use a PostgreSQL client or pgAdmin

---

## Troubleshooting

### Backend Won't Start

**Check Render logs for:**
- `password authentication failed` → Wrong DATABASE_URL password in Render environment
- `relation "users" does not exist` → Schema search path issue (should be fixed in database.ts)
- `Cannot find module` → Build command missing dependencies

**Fix:**
1. Verify environment variables in Render
2. Check build logs for errors
3. Ensure `cp -r src/data dist/data` in build command

### Frontend Can't Connect to Backend

**Check:**
1. `frontend/.env.production` has correct VITE_API_URL
2. Rebuild frontend after changing .env.production
3. CORS error? Check FRONTEND_URL in backend environment matches frontend URL

**Test:**
```
https://civic-trivia-backend.onrender.com/health
```
Should return JSON health status

### Database Connection Issues

**Check:**
1. Supabase password is current (reset if unsure)
2. DATABASE_URL in Render has correct password
3. DATABASE_URL includes `?options=--search_path%3Dcivic_trivia`
4. Tables exist in `civic_trivia` schema in Supabase

### Redis Connection Issues

**Check:**
1. Upstash database is active
2. REDIS_URL in Render has correct password
3. URL starts with `rediss://` (double 's' for TLS)

---

## Security Notes

### Passwords Not in Git

**Never commit:**
- `.env` files with real passwords
- Database passwords
- API keys

**Safe to commit:**
- `.env.example` files with placeholder values
- `frontend/.env.production` (only contains public API URL)

### Stored Passwords

**Location:** Render environment variables (encrypted)

**To rotate passwords:**
1. Reset in Supabase/Upstash
2. Update in Render environment variables
3. Redeploy service

---

## Team Access

### Adding Volunteers to GitHub

1. Go to https://github.com/orgs/EmpoweredVote/people
2. Click "Invite member"
3. Enter their GitHub username
4. Choose role (Member or Owner)

### Render Access

**Current limitation:** Free tier doesn't support team members

**Options:**
- Volunteers create their own Render accounts and deploy from the org repo
- Or one person manages Render deployments
- Or upgrade to Render Team plan ($19/month) for shared access

### Supabase Access

**Current:** Only chris@empowered.vote has access

**To add team members:**
1. Supabase Project Settings → Team
2. Invite members (requires Pro plan for multiple users)

---

## Cost Breakdown

**Current Monthly Costs:**

- GitHub: $0 (org is free for open source)
- Render: $0 (free tier)
- Supabase: $0 (free tier, paid plan available)
- Upstash: $0 (free tier)

**Total: $0/month**

**If scaling needed:**
- Render Team: $19/month (team access + better performance)
- Supabase Pro: $25/month (more storage, better support)
- Upstash Pro: Pay as you go (only if exceeding free tier)

---

## Next Steps

**Immediate:**
- [x] Backend deployed and working
- [x] Frontend deployed and working
- [x] Database connected
- [x] Full game flow tested
- [ ] Invite volunteers to GitHub org
- [ ] Add to ev-prototypes.netlify.app (optional)
- [ ] Set up UptimeRobot to prevent sleep (optional)

**Future Improvements:**
- Add staging environment (use Supabase Public project)
- Set up CI/CD for automated testing
- Add error monitoring (Sentry, LogRocket)
- Optimize bundle size
- Add analytics

---

## Support Resources

**Render:**
- Docs: https://render.com/docs
- Community: https://community.render.com

**Supabase:**
- Docs: https://supabase.com/docs
- Community: https://github.com/supabase/supabase/discussions

**GitHub:**
- Docs: https://docs.github.com

**Questions?**
- Check .planning/STATE.md for current status
- Check .planning/ROADMAP.md for feature plans
- Post in team Slack/Discord

---

*Last deployment: 2026-02-17*  
*Deployed by: Chris (@EmpoweredChris)*  
*Status: ✅ All systems operational*
