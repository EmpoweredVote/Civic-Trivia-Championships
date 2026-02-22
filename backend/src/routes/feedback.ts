/**
 * Feedback routes for question flagging
 * POST /flag - Create flag (authenticated + rate limited)
 * DELETE /flag/:questionId - Remove flag (authenticated only)
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { flagRateLimiter } from '../middleware/rateLimiter.js';
import { createFlag, deleteFlag } from '../services/feedbackService.js';
import { db } from '../db/index.js';
import { questions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * POST /flag - Create a flag for a question
 * Body: { questionId: string (externalId), sessionId: string }
 * Middleware: authenticateToken, flagRateLimiter
 * Returns: { success: true, created: boolean, flagId: number }
 */
router.post(
  '/flag',
  authenticateToken,
  flagRateLimiter,
  body('questionId').isString().notEmpty(),
  body('sessionId').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { questionId: externalId, sessionId } = req.body;
      const userId = req.user!.userId;

      // Look up question by externalId
      const question = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.externalId, externalId))
        .limit(1);

      if (question.length === 0) {
        res.status(404).json({ error: 'Question not found' });
        return;
      }

      // Create flag
      const result = await createFlag(userId, question[0].id, sessionId);

      res.status(result.created ? 201 : 200).json({
        success: true,
        created: result.created,
        flagId: result.flagId,
      });
    } catch (error: any) {
      console.error('Error creating flag:', error);
      res.status(500).json({ error: 'Failed to create flag' });
    }
  }
);

/**
 * DELETE /flag/:questionId - Remove a flag from a question
 * Params: questionId (externalId)
 * Middleware: authenticateToken (NO rate limiter)
 * Returns: { success: true, deleted: boolean }
 */
router.delete(
  '/flag/:questionId',
  authenticateToken,
  param('questionId').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { questionId: externalId } = req.params;
      const userId = req.user!.userId;

      // Look up question by externalId
      const question = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.externalId, externalId))
        .limit(1);

      if (question.length === 0) {
        res.status(404).json({ error: 'Question not found' });
        return;
      }

      // Delete flag
      const deleted = await deleteFlag(userId, question[0].id);

      res.status(200).json({
        success: true,
        deleted,
      });
    } catch (error: any) {
      console.error('Error deleting flag:', error);
      res.status(500).json({ error: 'Failed to delete flag' });
    }
  }
);

export default router;
