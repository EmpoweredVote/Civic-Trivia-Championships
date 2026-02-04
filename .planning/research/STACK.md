# Technology Stack

**Project:** Civic Trivia Championship
**Researched:** 2026-02-03
**Overall Confidence:** HIGH

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | 19.2.4+ | UI framework | Current stable with Actions API, useOptimistic for game state, and improved hydration. React 19 released Dec 2024. | HIGH |
| TypeScript | 5.5+ | Type safety | Industry standard for reliability. Zod requires 5.5+. | HIGH |
| Vite | 7.3.1+ | Build tool | 10-20x faster than Webpack. Native ESM, HMR <50ms. Requires Node 20.19+. | HIGH |
| Node.js | 20.19+ or 22.12+ | Runtime | Required by Vite 7. LTS versions with ESM support. | HIGH |

### Frontend Libraries

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| Tailwind CSS | 4.1+ | Styling | v4 released 2024. Faster builds, native cascade layers. Bundle impact minimal. | HIGH |
| Motion (Framer Motion) | 12.27+ | Animation | Fastest-growing animation lib (12M+ downloads/mo). GPU-accelerated. Now called "Motion" (was Framer Motion). v12 has no breaking changes. | HIGH |
| TanStack Query | 5.x | Server state | Industry standard for data fetching, caching. Separate server/client state. | HIGH |
| Zustand | 4.x | Client state | Lightweight (2.5KB), zero boilerplate. Perfect for quiz flow state (current question, timer, score). | HIGH |
| React Router | 7.12+ | Routing | v7 merges Remix patterns. Latest stable Jan 2026. Import from 'react-router' (no more react-router-dom). | HIGH |
| Zod | 3.x | Validation | TypeScript-first runtime validation. 2KB gzipped, zero dependencies. Critical for API boundaries. | HIGH |

### Backend Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Fastify | 5.x | HTTP server | 76K req/sec (vs Express ~50K). Better JSON serialization. Modern plugin architecture. | MEDIUM |
| Express | 4.x (alternative) | HTTP server | Battle-tested, wider ecosystem. Use if team familiarity matters more than performance. | HIGH |

**Recommendation:** Use **Fastify** for new greenfield projects in 2026. Express is still solid for enterprise/legacy compatibility.

### Database & Caching

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PostgreSQL | 16+ | Primary database | Mature, ACID compliant. Perfect for user data, quiz history. | HIGH |
| Drizzle ORM | Latest | ORM | Lightweight (7.4KB), tree-shakeable, zero deps. 14x faster than ORMs with N+1 problems. Edge-ready. | MEDIUM |
| Prisma | 5.x (alternative) | ORM | Better DX, easier learning curve. Use for rapid prototyping. | MEDIUM |
| Redis | 7.x | Cache/sessions | Session storage, leaderboard caching. | HIGH |
| node-redis | 4.x | Redis client | Official recommendation (ioredis now on maintenance-only). | MEDIUM |

**Recommendation:** Use **Drizzle** for performance and edge compatibility. Use **Prisma** if DX/speed matters more than latency.

### Authentication

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| jose | 5.x | JWT handling | Zero deps, ESM-first, works across Node/Edge/Cloudflare. Tree-shakeable. | HIGH |
| jsonwebtoken | 9.x (alternative) | JWT handling | More established, auth0-maintained. Use if not deploying to edge. | HIGH |

**Recommendation:** Use **jose** for modern ESM projects, especially if edge deployment is possible. Use **jsonwebtoken** for traditional Node.js servers.

### Testing

| Tool | Version | Purpose | Why | Confidence |
|------|---------|---------|-----|------------|
| Vitest | 3.x | Test runner | 10-20x faster than Jest. Native ESM, Vite integration. Browser mode for component tests. | HIGH |
| React Testing Library | 16.x | Component tests | User-centric testing. Industry standard. | HIGH |
| Playwright | 1.x | E2E testing | Best for interactive game flows. Multi-browser support. | HIGH |

**Recommendation:** Use **Vitest** for unit/component tests (fast feedback). Use **Playwright** for E2E (quiz flow, timer behavior, score calculation).

### Performance & Optimization

| Tool | Version | Purpose | Why | Confidence |
|------|---------|---------|-----|------------|
| vite-plugin-pwa | 0.x | PWA support | Offline support, install prompt. | MEDIUM |
| sharp | Latest | Image optimization | Fast image processing for avatars, badges. | HIGH |

### Game-Specific Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| use-sound (Howler.js) | 4.x | Sound effects | Button clicks, correct/wrong answers, countdown ticks. Howler.js is 7KB, supports Web Audio + HTML5 Audio fallback. | MEDIUM |
| react-confetti | Latest | Celebration effects | Win screens, achievements. Lightweight alternative to complex particle systems. | LOW |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| clsx / classnames | Latest | Conditional CSS | Tailwind className composition | HIGH |
| date-fns | 3.x | Date formatting | Leaderboard timestamps, quiz history | HIGH |
| express-rate-limit (Fastify equiv) | Latest | API protection | Prevent quiz answer spam, protect endpoints | MEDIUM |
| helmet (Fastify equiv) | Latest | Security headers | XSS protection, CSP | HIGH |
| cors | Latest | CORS handling | Allow frontend to call backend | HIGH |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not | Confidence |
|----------|-------------|-------------|---------|------------|
| Animation | Motion (Framer Motion) 12 | react-spring, GSAP | Motion has better React integration, smaller bundle. GSAP requires license for commercial use. | HIGH |
| State Management (Global) | Zustand | Redux Toolkit, Jotai | Redux is overkill for quiz state. Jotai less mature. | HIGH |
| State Management (Server) | TanStack Query | SWR, Apollo | TanStack has better DevTools, more features (infinite queries, prefetching). | MEDIUM |
| Backend Framework | Fastify | Express, Hono, Koa | Express slower but more stable ecosystem. Hono best for edge (not needed). Koa minimal ecosystem. | MEDIUM |
| ORM | Drizzle | Prisma, TypeORM | Prisma has vendor lock-in (PSL DSL). TypeORM has spotty maintenance. | MEDIUM |
| Testing | Vitest | Jest | Jest v30 improved, but Vitest still 10-20x faster and native ESM. | HIGH |
| Build Tool | Vite | Webpack, Turbopack | Webpack slow. Turbopack still experimental (Next.js-focused). | HIGH |
| Timer Implementation | Custom useEffect hook | react-countdown | Custom hook gives full control over quiz timer logic. react-countdown adds dependency for simple use case. | MEDIUM |

## Quiz-Specific Architecture Decisions

### Timer Implementation
**Recommended Approach:** Custom `useCountdown` hook with `requestAnimationFrame`

```typescript
// High-level structure (not full implementation)
function useCountdown(initialSeconds: number) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const rafRef = useRef<number>();

  useEffect(() => {
    let lastTimestamp = performance.now();

    const tick = (timestamp: number) => {
      const elapsed = timestamp - lastTimestamp;
      if (elapsed >= 1000) {
        setTimeLeft(prev => Math.max(0, prev - 1));
        lastTimestamp = timestamp;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current!);
  }, []);

  return timeLeft;
}
```

**Why:**
- `requestAnimationFrame` syncs with browser refresh (60Hz/120Hz adaptive)
- Prevents drift vs `setInterval` (which can lag under CPU load)
- Timestamp-based calculation ensures accuracy on high refresh rate displays
- `useRef` avoids re-renders on every frame
- Proper cleanup prevents memory leaks

**Confidence:** HIGH (verified with [requestAnimationFrame React best practices](https://blog.openreplay.com/use-requestanimationframe-in-react-for-smoothest-animations/))

### Animation Strategy
**Layer animations for performance:**

1. **GPU-accelerated transforms** (Motion/Framer Motion): Button presses, card flips, screen transitions
2. **CSS transitions**: Color changes (timer warnings), background shifts
3. **requestAnimationFrame**: Timer countdown visual (avoid triggering React re-render every frame)

**Why:**
- Motion uses `transform` and `opacity` which trigger GPU acceleration
- Avoid animating `width`, `height`, `top`, `left` (triggers layout recalculation)
- Centralize `requestAnimationFrame` loops (avoid multiple loops)

**Confidence:** HIGH

### State Architecture
**Separation of concerns:**

- **Zustand:** Quiz flow state (currentQuestion, score, timeLeft, gamePhase)
  - Why: Fast updates, no provider hell, easy to debug
- **TanStack Query:** API data (questions, user profile, leaderboard)
  - Why: Caching, refetching, optimistic updates
- **React useState:** Local UI state (button hover, modal open)
  - Why: Component-scoped, no need for global

**Confidence:** HIGH

## Performance Targets & Strategies

| Target | Strategy | Tools |
|--------|----------|-------|
| FCP < 1.5s | Code splitting (React.lazy), preload critical fonts, inline critical CSS | Vite automatic chunking, Lighthouse CI |
| TTI < 3s | Defer non-critical JS, prefetch quiz data on route load | TanStack Query prefetch, React Router loader |
| Bundle < 300KB gzipped | Tree-shaking, analyze bundle, avoid heavy deps | vite-bundle-visualizer, rollup-plugin-visualizer |
| Smooth 60fps animations | GPU transforms, avoid layout thrashing, RAF for timers | Motion, Chrome DevTools Performance |

**Bundle Breakdown (estimated):**
- React 19 + React DOM: ~45KB gzipped
- Motion (Framer Motion): ~35KB gzipped (tree-shaken)
- TanStack Query: ~12KB gzipped
- Zustand: ~2.5KB gzipped
- React Router: ~25KB gzipped
- Tailwind CSS (purged): ~10-20KB gzipped
- App code + components: ~80-120KB gzipped
- **Total: ~210-260KB gzipped** (within budget)

**Confidence:** MEDIUM (estimates based on typical builds, needs verification in actual implementation)

## Installation

### Frontend
```bash
# Core
npm install react@19 react-dom@19 react-router@7

# State & Data
npm install @tanstack/react-query zustand

# UI & Animation
npm install framer-motion clsx

# Validation
npm install zod

# Optional
npm install use-sound react-confetti

# Dev dependencies
npm install -D vite@7 @vitejs/plugin-react typescript@5.5 tailwindcss@4 postcss autoprefixer
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @types/react @types/react-dom @types/node
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### Backend (Fastify example)
```bash
# Core
npm install fastify@5

# Database
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Auth & Security
npm install jose
npm install @fastify/cors @fastify/helmet @fastify/rate-limit

# Redis
npm install redis

# Validation
npm install zod

# Dev dependencies
npm install -D tsx @types/node
npm install -D vitest
```

### Backend (Express alternative)
```bash
# Core
npm install express

# Database (same as above)
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Auth & Security
npm install jose
npm install cors helmet express-rate-limit

# Redis
npm install redis

# Validation
npm install zod

# Dev dependencies
npm install -D tsx @types/node @types/express @types/cors
npm install -D vitest
```

## Version Management
**Use exact versions in package.json for reproducibility:**
```json
{
  "dependencies": {
    "react": "19.2.4",
    "framer-motion": "12.27.0"
  }
}
```

**Or use lockfile (package-lock.json / pnpm-lock.yaml) and CI checks.**

## Critical Configuration Notes

### Vite Config (vite.config.ts)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // Modern browsers (Chrome 107+, Firefox 104+, Safari 16+)
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'animation': ['framer-motion'],
          'data': ['@tanstack/react-query', 'zustand']
        }
      }
    }
  }
});
```

### Tailwind Config (tailwind.config.js)
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'countdown-pulse': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
};
```

### TypeScript Config (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "skipLibCheck": true
  }
}
```

## Migration Notes

### If coming from Create React App:
1. Vite uses `index.html` at root (not `public/`)
2. Change `%PUBLIC_URL%` to `/` in HTML
3. Update imports: `import.meta.env.VITE_*` instead of `process.env.REACT_APP_*`
4. Vite dev server is `vite` (not `react-scripts start`)

### If coming from Next.js:
1. No automatic routing (use React Router explicitly)
2. No server components (use TanStack Query for data fetching)
3. No automatic API routes (build separate backend with Fastify/Express)

## Development Workflow

1. **Local Development:**
   - Frontend: `npm run dev` (Vite dev server on `localhost:5173`)
   - Backend: `npm run dev` (tsx watch mode on `localhost:3000`)
   - HMR updates in <50ms with Vite

2. **Testing:**
   - Unit: `npm run test` (Vitest watch mode)
   - E2E: `npm run test:e2e` (Playwright)
   - Coverage: `npm run test:coverage`

3. **Build:**
   - `npm run build` (Vite production build)
   - Outputs to `dist/` directory
   - Analyze: `npm run build -- --analyze` (with vite-bundle-visualizer)

## Deployment Considerations

### Frontend (Static Hosting)
- **Vercel, Netlify, Cloudflare Pages:** Native Vite support
- **S3 + CloudFront:** Upload `dist/` folder, configure SPA routing

### Backend
- **Fly.io, Railway, Render:** Native Node.js support
- **AWS ECS/Fargate:** Dockerize Fastify/Express app
- **Serverless:** Avoid with Drizzle (use Prisma Accelerate or PlanetScale for edge)

### Database
- **Managed PostgreSQL:** Neon, Supabase, AWS RDS, DigitalOcean
- **Redis:** Upstash (serverless), Redis Cloud, AWS ElastiCache

## Known Limitations & Tradeoffs

| Choice | Limitation | Mitigation |
|--------|-----------|------------|
| React 19 | Newer version, some libs may lag | Check compatibility before adding deps |
| Vite 7 | Requires Node 20.19+ | Ensure CI/CD uses correct Node version |
| Drizzle ORM | Smaller ecosystem than Prisma | May need to write custom helpers |
| Fastify | Smaller ecosystem than Express | Plugin availability generally good |
| Motion 12 | Bundle size ~35KB | Lazy load if not needed immediately |
| Vitest | Slightly less mature than Jest | Growing rapidly, ecosystem catching up |

## Future-Proofing

**Technologies to watch:**
- **Vite 8:** Currently in beta (v8.0.0-beta series as of Jan 2026)
- **React 20:** Not announced, React 19 is current
- **Tailwind CSS 4.x:** Just released, monitor for v4.2+
- **TanStack Router:** Alternative to React Router, gaining traction

**Upgrade strategy:**
- Pin major versions initially
- Test upgrades in separate branch
- Monitor GitHub releases for breaking changes
- Use Dependabot for automated updates

## Sources

### Official Documentation
- [React v19 Release](https://react.dev/blog/2024/12/05/react-19) - HIGH confidence
- [React 19 Releases](https://github.com/facebook/react/releases) - HIGH confidence (verified 19.2.4, Jan 26 2026)
- [Vite 7 Announcement](https://vite.dev/blog/announcing-vite7) - HIGH confidence
- [Vite Releases](https://github.com/vitejs/vite/releases) - HIGH confidence (verified 7.3.1)
- [Tailwind CSS Docs](https://tailwindcss.com/docs/installation) - HIGH confidence (verified v4.1)
- [Motion Changelog](https://motion.dev/changelog) - MEDIUM confidence
- [React Router v7 Blog](https://remix.run/blog/react-router-v7) - MEDIUM confidence

### Library Comparisons
- [Node.js ORMs in 2025: Prisma, Drizzle, TypeORM](https://thedataguy.pro/blog/2025/12/nodejs-orm-comparison-2025/) - MEDIUM confidence
- [Fastify vs Express vs Hono](https://medium.com/@arifdewi/fastify-vs-express-vs-hono-choosing-the-right-node-js-framework-for-your-project-da629adebd4e) - MEDIUM confidence
- [React Testing in 2026: Jest, Vitest, RTL](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies) - MEDIUM confidence
- [Drizzle vs Prisma](https://betterstack.com/community/guides/scaling-nodejs/drizzle-vs-prisma/) - MEDIUM confidence

### Best Practices
- [requestAnimationFrame in React](https://blog.openreplay.com/use-requestanimationframe-in-react-for-smoothest-animations/) - HIGH confidence
- [React Quiz Timer Implementation](https://medium.com/@biswajitpanda973/adding-countdown-timer-in-our-react-quiz-app-using-effect-hook-7ae4f3750e8f) - MEDIUM confidence
- [Howler.js with React](https://medium.com/swlh/getting-started-with-howler-js-in-react-67d3a348854b) - MEDIUM confidence
- [JWT: jose vs jsonwebtoken](https://github.com/panva/jose) - HIGH confidence

### Package Registries
- [ioredis GitHub](https://github.com/redis/ioredis) - HIGH confidence (verified maintenance mode)
- [Zod Documentation](https://zod.dev/) - HIGH confidence

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Core Framework (React, Vite, TypeScript) | HIGH | Verified versions from official sources (GitHub releases, docs) |
| UI Libraries (Tailwind, Motion) | HIGH | Verified versions, widely adopted |
| State Management (Zustand, TanStack Query) | HIGH | Industry standard pattern, recent sources |
| Backend (Fastify vs Express) | MEDIUM | Fastify performance claims verified, but Express still dominant |
| ORM (Drizzle vs Prisma) | MEDIUM | Drizzle performance claims from multiple sources, but Prisma has larger ecosystem |
| Testing (Vitest vs Jest) | HIGH | Multiple 2025-2026 sources confirm Vitest speed advantage |
| Timer Implementation | HIGH | requestAnimationFrame best practice verified across sources |
| Bundle Size Estimates | MEDIUM | Based on typical builds, needs project-specific verification |
| Game Audio (Howler.js) | MEDIUM | Widely used but sources from 2020-2021 |

## Research Gaps

**Areas requiring phase-specific research:**
1. **Real-time leaderboards:** WebSocket vs polling vs SSE (not investigated in this research)
2. **Offline support:** PWA caching strategy for quiz questions (mentioned but not detailed)
3. **Image optimization:** CDN strategy for civic images (mentioned Sharp but not full workflow)
4. **Analytics:** User behavior tracking (not investigated)
5. **Accessibility:** ARIA for quiz interactions (not investigated in depth)

**These gaps are intentional** - this research focuses on the core stack. Specific features will require deeper research during their respective phases.
