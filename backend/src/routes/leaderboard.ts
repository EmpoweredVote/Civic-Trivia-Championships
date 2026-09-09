/**
 * ⚠ RETIRED SERVICE — civic-trivia-backend no longer runs in production.
 * This Express server's HTTP API was merged into ev-accounts
 * (api.empowered.vote); the live auth / admin / game endpoints are served
 * there now. This file is kept for reference and history only — do NOT debug
 * live behavior against it, and do not assume it reflects production auth.
 * See .planning/DEPLOYMENT.md ("Backend Web Service — SUSPENDED").
 */

/**
 * GET /api/leaderboard — Public leaderboard route with 60-second cache.
 *
 * Schema findings (2026-03-17):
 *   - connect.connected_profiles: user_id, display_name, total_xp, current_level,
 *     verification_status, account_standing — queried directly via supabaseAdmin
 *     service role (bypasses PostgREST schema restrictions)
 *   - connect.xp_transactions: user_id, amount, created_at — used for This Week
 *     rolling 7-day SUM
 *   - Tier derivation: verification_status === 'verified' → 'connected'; else 'inform'
 *     (empowered tier not yet distinguishable from Supabase data alone)
 *   - Direct .schema('connect').from() access confirmed working — no SECURITY DEFINER
 *     function needed
 *
 * Response shape:
 *   {
 *     tab: 'all_time' | 'this_week',
 *     entries: Array<{ rank, user_id, username, tier, level, total_xp }>,
 *     userRank: { rank, username, tier, level, total_xp, gap_to_next } | null,
 *     generatedAt: string (ISO),
 *   }
 */
import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { storageFactory } from '../config/redis.js';

export const router = Router();

const CACHE_TTL = 60; // 60 seconds
const LEADERBOARD_LIMIT = 25;

// ---- Cache helpers ----
// The SessionStorage abstraction is typed for GameSession only (session:* keys,
// Date deserialization). Leaderboard uses generic string key/value caching.
// Strategy: use raw Redis client when available; fall back to a module-level Map.

interface MemCacheEntry { value: string; expiresAt: number }
const memCache = new Map<string, MemCacheEntry>();

async function cacheGet(key: string): Promise<string | null> {
  const redisClient = storageFactory.getRawClient();
  if (redisClient) {
    return await redisClient.get(key);
  }
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.value;
}

async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const redisClient = storageFactory.getRawClient();
  if (redisClient) {
    await redisClient.setEx(key, ttlSeconds, value);
    return;
  }
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

type Tier = 'inform' | 'connected' | 'empowered';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  tier: Tier;
  level: number;
  total_xp: number;
}

interface UserRank {
  rank: number;
  username: string;
  tier: Tier;
  level: number;
  total_xp: number;
  gap_to_next: number;
}

interface LeaderboardResponse {
  tab: 'all_time' | 'this_week';
  entries: LeaderboardEntry[];
  userRank: UserRank | null;
  generatedAt: string;
}

function deriveTier(verificationStatus: string | null): Tier {
  if (verificationStatus === 'verified') return 'connected';
  return 'inform';
}

/**
 * Returns a safe public pseudonym for display on the leaderboard.
 * Privacy rule: never expose email addresses on a public page.
 * display_name from connected_profiles is the user's chosen pseudonym.
 * Email-shaped values are stripped as a safety net.
 */
function safeUsername(displayName: string | null | undefined): string {
  if (!displayName) return '';
  if (displayName.includes('@')) return ''; // email address — never show publicly
  return displayName;
}

/**
 * Fetch all-time leaderboard: top 25 users by total_xp from connected_profiles.
 */
async function fetchAllTimeEntries(): Promise<LeaderboardEntry[]> {
  const { data, error } = await (supabaseAdmin as any)
    .schema('connect')
    .from('connected_profiles')
    .select('user_id, display_name, total_xp, current_level, verification_status')
    .order('total_xp', { ascending: false })
    .limit(LEADERBOARD_LIMIT);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map((row: any, idx: number): LeaderboardEntry => ({
    rank: idx + 1,
    user_id: row.user_id,
    username: safeUsername(row.display_name),
    tier: deriveTier(row.verification_status),
    level: row.current_level ?? 0,
    total_xp: row.total_xp ?? 0,
  }));
}

/**
 * Fetch this-week leaderboard: top 25 users by XP earned in rolling 7 days.
 * Aggregates xp_transactions in JS since Supabase JS client doesn't support
 * GROUP BY directly — we fetch all transactions from last 7 days and aggregate.
 * (The expected row count is manageable — CTC is early-stage with limited users.)
 */
async function fetchThisWeekEntries(): Promise<LeaderboardEntry[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all XP transactions from the last 7 days
  const { data: txData, error: txError } = await (supabaseAdmin as any)
    .schema('connect')
    .from('xp_transactions')
    .select('user_id, amount')
    .gte('created_at', sevenDaysAgo);

  if (txError) throw txError;
  if (!txData || txData.length === 0) return [];

  // Aggregate XP by user
  const xpByUser = new Map<string, number>();
  for (const tx of txData) {
    xpByUser.set(tx.user_id, (xpByUser.get(tx.user_id) ?? 0) + (tx.amount ?? 0));
  }

  if (xpByUser.size === 0) return [];

  // Sort by XP descending, take top 25
  const sortedUserIds = [...xpByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LEADERBOARD_LIMIT)
    .map(([userId]) => userId);

  // Fetch profile data for these users
  const { data: profileData, error: profileError } = await (supabaseAdmin as any)
    .schema('connect')
    .from('connected_profiles')
    .select('user_id, display_name, current_level, verification_status')
    .in('user_id', sortedUserIds);

  if (profileError) throw profileError;

  // Build a lookup map
  const profileMap = new Map<string, any>();
  for (const profile of (profileData ?? [])) {
    profileMap.set(profile.user_id, profile);
  }

  // Assemble entries in sorted order
  return sortedUserIds.map((userId, idx): LeaderboardEntry => {
    const profile = profileMap.get(userId);
    const weekXp = xpByUser.get(userId) ?? 0;
    return {
      rank: idx + 1,
      user_id: userId,
      username: safeUsername(profile?.display_name),
      tier: deriveTier(profile?.verification_status ?? null),
      level: profile?.current_level ?? 0,
      total_xp: weekXp,
    };
  });
}

/**
 * Compute the requesting user's rank and gap_to_next for the given tab.
 */
async function fetchUserRank(
  userId: string,
  tab: 'all_time' | 'this_week',
  entries: LeaderboardEntry[]
): Promise<UserRank | null> {
  // Check if user is already in the top 25 entries
  const inTop = entries.find(e => e.user_id === userId);

  if (tab === 'all_time') {
    // Get user's profile data
    const { data: profileData, error: profileError } = await (supabaseAdmin as any)
      .schema('connect')
      .from('connected_profiles')
      .select('user_id, display_name, total_xp, current_level, verification_status')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profileData || (profileData.total_xp ?? 0) === 0) return null;

    const userXp = profileData.total_xp ?? 0;

    if (inTop) {
      // User is in top 25 — use their entries data for gap
      const rank = inTop.rank;
      const nextEntry = entries[rank - 2]; // entry ranked one above (rank - 1, index rank - 2)
      const gap = nextEntry ? nextEntry.total_xp - userXp : 0;
      return {
        rank,
        username: inTop.username,
        tier: inTop.tier,
        level: inTop.level,
        total_xp: userXp,
        gap_to_next: Math.max(0, gap),
      };
    }

    // Count users with higher XP
    const { count, error: countError } = await (supabaseAdmin as any)
      .schema('connect')
      .from('connected_profiles')
      .select('user_id', { count: 'exact', head: true })
      .gt('total_xp', userXp);

    if (countError) throw countError;

    const rank = (count ?? 0) + 1;

    // Find the user ranked one above (the one with the lowest XP still higher than ours)
    const { data: nextPlayerData, error: nextError } = await (supabaseAdmin as any)
      .schema('connect')
      .from('connected_profiles')
      .select('total_xp')
      .gt('total_xp', userXp)
      .order('total_xp', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextError) throw nextError;

    const gapToNext = nextPlayerData ? (nextPlayerData.total_xp - userXp) : 0;

    return {
      rank,
      username: safeUsername(profileData.display_name),
      tier: deriveTier(profileData.verification_status),
      level: profileData.current_level ?? 0,
      total_xp: userXp,
      gap_to_next: Math.max(0, gapToNext),
    };
  } else {
    // This Week: compute user's weekly XP
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: txData, error: txError } = await (supabaseAdmin as any)
      .schema('connect')
      .from('xp_transactions')
      .select('amount')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo);

    if (txError) throw txError;

    const userWeeklyXp = (txData ?? []).reduce((sum: number, tx: any) => sum + (tx.amount ?? 0), 0);
    if (userWeeklyXp === 0) return null;

    if (inTop) {
      const rank = inTop.rank;
      const nextEntry = entries[rank - 2];
      const gap = nextEntry ? nextEntry.total_xp - userWeeklyXp : 0;

      // Get profile data for username/tier/level
      const { data: profileData } = await (supabaseAdmin as any)
        .schema('connect')
        .from('connected_profiles')
        .select('display_name, current_level, verification_status')
        .eq('user_id', userId)
        .maybeSingle();

      return {
        rank,
        username: safeUsername(profileData?.display_name),
        tier: deriveTier(profileData?.verification_status ?? null),
        level: profileData?.current_level ?? 0,
        total_xp: userWeeklyXp,
        gap_to_next: Math.max(0, gap),
      };
    }

    // Count how many users with higher weekly XP
    // entries contains the full weekly aggregation — count entries with higher XP
    const higherCount = entries.filter(e => e.total_xp > userWeeklyXp).length;
    const rank = higherCount + 1;
    const nextEntry = entries.find(e => e.total_xp > userWeeklyXp && e.rank === higherCount);
    const gapToNext = nextEntry ? nextEntry.total_xp - userWeeklyXp : 0;

    const { data: profileData } = await (supabaseAdmin as any)
      .schema('connect')
      .from('connected_profiles')
      .select('display_name, current_level, verification_status')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      rank,
      username: safeUsername(profileData?.display_name),
      tier: deriveTier(profileData?.verification_status ?? null),
      level: profileData?.current_level ?? 0,
      total_xp: userWeeklyXp,
      gap_to_next: Math.max(0, gapToNext),
    };
  }
}

/**
 * GET /api/leaderboard
 * Query params:
 *   tab: 'all_time' | 'this_week' (default: 'all_time')
 *   userId: UUID string (optional) — include to get personal rank row
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const tab = req.query.tab === 'this_week' ? 'this_week' : 'all_time';
  const userId = typeof req.query.userId === 'string' && req.query.userId ? req.query.userId : undefined;

  // Separate cache keys: entries list shared across all visitors; user rank personalized
  const entriesCacheKey = `leaderboard:entries:${tab}`;
  const rankCacheKey = userId ? `leaderboard:rank:${tab}:${userId}` : null;

  try {
    // Try to load entries from cache
    let entries: LeaderboardEntry[] | null = null;
    const cachedEntries = await cacheGet(entriesCacheKey);
    if (cachedEntries) {
      console.log(`[leaderboard] cache hit: ${entriesCacheKey}`);
      entries = JSON.parse(cachedEntries) as LeaderboardEntry[];
    }

    // Use a sentinel to distinguish "cache miss" (UNCACHED) from "cached as null"
    const UNCACHED = Symbol('UNCACHED');
    let userRank: UserRank | null | typeof UNCACHED = UNCACHED;

    if (rankCacheKey) {
      const cachedRank = await cacheGet(rankCacheKey);
      if (cachedRank !== null) {
        console.log(`[leaderboard] cache hit: ${rankCacheKey}`);
        userRank = JSON.parse(cachedRank) as UserRank | null;
      }
    }

    // If entries are not cached, fetch from Supabase
    if (!entries) {
      console.log(`[leaderboard] cache miss: ${entriesCacheKey} — querying Supabase`);
      entries = tab === 'all_time' ? await fetchAllTimeEntries() : await fetchThisWeekEntries();
      await cacheSet(entriesCacheKey, JSON.stringify(entries), CACHE_TTL);
    }

    // If userRank was not found in cache and userId provided, compute it
    if (userId && rankCacheKey && userRank === UNCACHED) {
      console.log(`[leaderboard] computing user rank for ${userId}`);
      const computed = await fetchUserRank(userId, tab, entries);
      // Cache even null (user has no XP) to avoid redundant Supabase calls
      await cacheSet(rankCacheKey, JSON.stringify(computed), CACHE_TTL);
      userRank = computed;
    }

    const payload: LeaderboardResponse = {
      tab,
      entries,
      userRank: (userRank === UNCACHED ? null : userRank) as UserRank | null,
      generatedAt: new Date().toISOString(),
    };

    res.json(payload);
  } catch (err) {
    console.error('[leaderboard] query failed:', err);
    res.status(503).json({ error: 'Leaderboard temporarily unavailable' });
  }
});
