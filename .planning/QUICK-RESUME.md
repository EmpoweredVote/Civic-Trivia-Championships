# Quick Resume Guide for Claude

**Last Updated:** 2026-02-17  
**For:** Handing off Civic Trivia Championship project to another Claude instance

---

## TL;DR - What Just Happened

We successfully deployed Civic Trivia Championship to production! 🎉

**Live URLs:**
- Frontend: https://civic-trivia-frontend.onrender.com
- Backend: https://civic-trivia-backend.onrender.com

**What works:**
- Full signup/login flow
- 10-question trivia game with timer
- Learn More modals
- Wager mechanics on final question
- XP/gems progression
- User profiles

---

## Infrastructure Overview

```
GitHub Org: EmpoweredVote
├── Repo: Civic-Trivia-Championships
    ├── backend/ (Express TypeScript API)
    │   └── Deployed to: Render Web Service
    │       └── Connects to: Supabase PostgreSQL + Upstash Redis
    └── frontend/ (React Vite app)
        └── Deployed to: Render Static Site
            └── Calls backend API directly
```

---

## Key Files to Know

**Planning Docs (in .planning/):**
- `DEPLOYMENT.md` ← **READ THIS FIRST** - Complete infrastructure guide
- `STATE.md` - Current project status, what's done, what's next
- `ROADMAP.md` - Feature roadmap (v1.0 complete, v1.1 in progress)
- `PROJECT.md` - Core requirements and goals
- `REQUIREMENTS.md` - All requirements and traceability

**Code:**
- `backend/src/config/database.ts` - PostgreSQL connection (uses civic_trivia schema)
- `backend/.env` - Local development environment vars
- `frontend/.env.production` - Production API URL
- `backend/schema.sql` - Database schema definition

**Deployment:**
- Render auto-deploys on push to master
- Environment variables configured in Render dashboard
- Supabase hosts PostgreSQL (EV-Backend-Dev project)
- Upstash hosts Redis (civic-trivia-redis database)

---

## Common Commands

**Local Development:**
```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

**Deploy:**
```bash
git add .
git commit -m "Description"
git push origin master
# Render auto-deploys from GitHub
```

**Database:**
```bash
# Update local schema
cd backend
node update-local-schema.js
```

---

## What's Next (v1.1 Roadmap)

**Completed:**
- ✅ Phase 8: Dev tooling & docs
- ✅ Phase 9: Redis session migration (deployed!)

**Remaining:**
- Phase 10: Game UX improvements (positioning tweaks)
- Phase 11: Plausibility enhancement (anti-cheat)
- Phase 12: Learning content expansion (15% → 25-30%)

---

## Common Issues & Solutions

**"Backend won't start"**
→ Check Render logs, usually environment variable issue

**"Can't connect to database"**
→ Verify DATABASE_URL has `?options=--search_path%3Dcivic_trivia`

**"Frontend shows 'unexpected error'"**
→ Check CORS (FRONTEND_URL in backend) and API URL (VITE_API_URL in frontend)

**"Site is slow to load"**
→ Free tier sleep mode (15 min inactivity = 20-30s wake time)

---

## Team Context

**Chris (EmpoweredChris):**
- Executive Director of Empowered.Vote
- Works with volunteers on civic engagement platform
- Not a coder but systems designer from game industry
- Needs clear step-by-step guidance

**Volunteers:**
- 4-5 "vibe coding with Claude"
- Working on different features
- Need access to GitHub org
- May have separate Render accounts (free tier limitation)

**Other Features:**
- Other prototypes exist at ev-prototypes.netlify.app
- Shared Supabase project (civic_trivia uses separate schema)
- Multiple features in development

---

## Resume Checklist for New Claude

When starting a new session:

1. **Read DEPLOYMENT.md** - Understand the infrastructure
2. **Read STATE.md** - Know what's been done and what's next
3. **Check live site** - Verify it's still working
4. **Review ROADMAP.md** - Understand feature priorities
5. **Ask about blockers** - What's preventing progress?

---

## Quick Test Flow

Verify everything works:

1. Visit https://civic-trivia-frontend.onrender.com
2. Sign up with test account
3. Play through all 10 questions
4. Complete wager on final question
5. Check results screen (XP/gems awarded)
6. View profile (stats saved)
7. Try Learn More on a question

**Expected:** All steps work smoothly (first load may be slow - free tier)

---

## Environment Variables (Render)

**Backend:**
- `DATABASE_URL` - Supabase connection (with search_path)
- `REDIS_URL` - Upstash connection
- `FRONTEND_URL` - CORS origin
- `JWT_SECRET` - Token signing
- `JWT_REFRESH_SECRET` - Refresh token signing
- `NODE_ENV` - production

**Frontend:**
- `VITE_API_URL` - Backend URL

**See DEPLOYMENT.md for full details and actual values**

---

## Account Access

**GitHub:** EmpoweredVote organization  
**Render:** Chris's personal account (chris@empowered.vote)  
**Supabase:** Chris's account, EV-Backend-Dev project  
**Upstash:** Chris's account, civic-trivia-redis database

**Limitation:** Free tiers don't allow multiple team members. Volunteers can create their own free accounts and deploy from the org repo.

---

## Design Philosophy (Important!)

From PROJECT.md:

1. **Play, Not Study** - Game show aesthetics, exciting pacing
2. **Learn Through Discovery** - Questions reveal interesting facts
3. **Inclusive Competition** - Anyone can play regardless of knowledge
4. **No Dark Patterns** - No daily streaks, loss aversion, or social pressure

**Tone:** "Not quite" instead of "Wrong", focus on teaching not judging

---

## Cost Breakdown

**Current: $0/month** (all free tiers)

**If scaling needed:**
- Render Team: $19/month (team access + performance)
- Supabase Pro: $25/month (more storage)
- Upstash Pro: Pay as you go

---

## Success Metrics (from v1.0)

**Delivered:**
- 50/50 requirements (100%)
- 7/7 phases complete
- 30 plans executed
- ~115 min total execution time
- Fully deployed and operational

**Quality:**
- WCAG AA accessible
- 60fps animations
- <300KB bundle size
- <1.5s FCP, <3s TTI

---

## Red Flags to Watch For

❌ **Don't do these:**
- Commit .env files with real passwords
- Deploy without testing locally first
- Ignore free tier limits
- Break WCAG accessibility
- Add dark patterns (streaks, timers, pressure)

✅ **Always do:**
- Test locally before pushing
- Read DEPLOYMENT.md for infrastructure changes
- Maintain accessibility standards
- Follow "Play, Not Study" philosophy
- Keep Chris in the loop

---

## When in Doubt

**Technical issues:** Check DEPLOYMENT.md troubleshooting  
**Feature questions:** Check ROADMAP.md and REQUIREMENTS.md  
**Philosophy questions:** Check PROJECT.md design principles  
**Current status:** Check STATE.md

**Most important:** Chris knows his volunteers and org context. When unclear, ask before implementing!

---

*This guide gets you 80% caught up. Read DEPLOYMENT.md for the other 20%.*
