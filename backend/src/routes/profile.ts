import { Router, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { join, extname } from 'path';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import { User } from '../models/User.js';

export const router = Router();

// Ensure uploads directory exists
const UPLOAD_DIR = './uploads/avatars';
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueName = randomUUID() + extname(file.originalname);
    cb(null, uniqueName);
  },
});

// File filter for MIME type validation
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
  }
};

// Configure Multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

// Apply authentication to all profile routes
router.use(authenticateToken);

/**
 * GET / - Fetch profile stats
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Fetch user stats
    const stats = await User.getProfileStats(userId);
    if (!stats) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Also need name and email from full user record
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Calculate accuracy
    const overallAccuracy =
      stats.totalQuestions > 0
        ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
        : 0;

    res.json({
      totalXp: stats.totalXp,
      totalGems: stats.totalGems,
      gamesPlayed: stats.gamesPlayed,
      bestScore: stats.bestScore,
      overallAccuracy,
      avatarUrl: stats.avatarUrl,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * POST /avatar - Upload avatar image with magic byte validation
 */
router.post(
  '/avatar',
  upload.single('avatar'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Magic byte validation
      const buffer = readFileSync(req.file.path);
      const fileType = await fileTypeFromBuffer(buffer);

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!fileType || !allowedTypes.includes(fileType.mime)) {
        // Delete the uploaded file
        unlinkSync(req.file.path);
        res.status(400).json({
          error: 'Invalid file type. File content does not match allowed image types.',
        });
        return;
      }

      // Construct avatar URL
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // Update user's avatar URL in database
      const userId = req.user!.userId;
      await User.updateAvatarUrl(userId, avatarUrl);

      res.json({ avatarUrl });
    } catch (error) {
      console.error('Error uploading avatar:', error);

      // Clean up file if it exists
      if (req.file && existsSync(req.file.path)) {
        unlinkSync(req.file.path);
      }

      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  }
);

// Multer error handler
router.use((error: Error, _req: Request, res: Response, _next: any) => {
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large (max 5MB)' });
      return;
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({ error: 'Only one file allowed' });
      return;
    }
  }

  if (error.message.includes('Invalid file type')) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({ error: 'Upload error' });
});
