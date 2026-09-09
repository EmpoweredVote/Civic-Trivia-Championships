/**
 * ⚠ RETIRED SERVICE — civic-trivia-backend no longer runs in production.
 * This Express server's HTTP API was merged into ev-accounts
 * (api.empowered.vote); the live auth / admin / game endpoints are served
 * there now. This file is kept for reference and history only — do NOT debug
 * live behavior against it, and do not assume it reflects production auth.
 * See .planning/DEPLOYMENT.md ("Backend Web Service — SUSPENDED").
 */

import { Router, Request, Response } from 'express';
import { requireAuth, resolveAdminContext } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { playerStats, playerPrefs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { supabaseAdmin } from '../config/supabase.js';

export const router = Router();

// Apply authentication to all profile routes
router.use(requireAuth);

/**
 * GET /identity - Return the authenticated user's UUID for cross-app identity debugging.
 * Used to verify the same user_id is seen by CTC and other Empowered platform apps.
 */
router.get('/identity', (req: Request, res: Response): void => {
  res.json({ user_id: req.userId });
});

/**
 * GET /admin-status - Check whether the current user has CTC admin access.
 * Returns { isAdmin, isSuperAdmin, roles } — isAdmin is true for anyone in
 * admin_users OR holding an active content-admin role; isSuperAdmin remains
 * admin_users-only. Used by the frontend AdminGuard; does NOT require admin
 * role itself.
 */
router.get('/admin-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { isAdmin, isSuperAdmin, roles } = await resolveAdminContext(req.userId!);
    res.json({ isAdmin, isSuperAdmin, roles });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

/**
 * GET / - Fetch profile stats
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const [stats] = await db.select().from(playerStats).where(eq(playerStats.userId, userId));
    const [prefs] = await db.select().from(playerPrefs).where(eq(playerPrefs.userId, userId));

    const overallAccuracy =
      stats && stats.totalQuestions > 0
        ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
        : 0;

    res.json({
      gamesPlayed: stats?.gamesPlayed ?? 0,
      bestScore: stats?.bestScore ?? 0,
      overallAccuracy,
      timerMultiplier: prefs?.timerMultiplier ?? 1.0,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PATCH /settings - Update user settings (timer multiplier, etc.)
 */
router.patch('/settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { timerMultiplier } = req.body;

    const validMultipliers = [1.0, 1.5, 2.0];
    if (!timerMultiplier || !validMultipliers.includes(timerMultiplier)) {
      res.status(400).json({ error: 'Invalid timer multiplier. Must be 1.0, 1.5, or 2.0' });
      return;
    }

    await db
      .insert(playerPrefs)
      .values({ userId, timerMultiplier })
      .onConflictDoUpdate({ target: playerPrefs.userId, set: { timerMultiplier } });

    res.json({ timerMultiplier });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /xp/history - Fetch XP transaction history directly from Supabase via
 * the get_ctc_xp_history() SECURITY DEFINER function (bypasses PostgREST
 * schema exposure issues with the connect schema).
 * Only accessible to authenticated users (requireAuth applied at router level).
 */
router.get('/xp/history', async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const { data, error } = await supabaseAdmin.rpc('get_ctc_xp_history' as any, {
    p_user_id: req.userId!,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) {
    console.error('[profile] get_ctc_xp_history error:', error.message);
    res.status(500).json({ error: 'Failed to fetch XP history' });
    return;
  }

  const result = data as unknown as { entries: any[]; total: number };
  const totalPages = Math.ceil(result.total / pageSize);

  res.json({
    entries: result.entries,
    total: result.total,
    page,
    pageSize,
    totalPages,
  });
});
