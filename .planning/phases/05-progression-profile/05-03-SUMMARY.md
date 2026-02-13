---
phase: 05
plan: 03
subsystem: backend-api
tags: [express, multer, file-upload, authentication, profile]
requires: [05-01]
provides:
  - Profile API endpoints (GET stats, POST avatar)
  - Secure file upload with validation
  - Static file serving for avatars
affects: [05-04]
decisions:
  - id: multer-2.0
    desc: Use Multer 2.0.2 to avoid CVE-2025-47935 and CVE-2025-47944
  - id: magic-byte-validation
    desc: Validate file content with file-type library, not just MIME type
  - id: uuid-filenames
    desc: Use crypto.randomUUID for filenames to prevent path traversal
  - id: 5mb-limit
    desc: Limit avatar uploads to 5MB for reasonable file sizes
tech-stack:
  added:
    - multer@2.0.2
    - file-type@21.3.0
  patterns:
    - Secure file upload with multi-layer validation
    - Static file serving via Express
key-files:
  created:
    - backend/src/routes/profile.ts
  modified:
    - backend/src/server.ts
    - .gitignore
metrics:
  duration: 4 min
  tasks: 2
  commits: 2
  completed: 2026-02-12
---

# Phase 5 Plan 03: Profile API Backend Summary

**One-liner:** Profile API with GET stats endpoint (XP/gems/accuracy) and POST avatar upload secured by MIME + magic byte validation, UUID filenames, 5MB limit.

## What Was Built

### Profile API Endpoints

**GET /api/users/profile:**
- Returns complete user progression stats
- Fields: totalXp, totalGems, gamesPlayed, bestScore, overallAccuracy, avatarUrl, name, email
- Accuracy calculated as whole number percentage: `Math.round((totalCorrect / totalQuestions) * 100)` or 0 if no games played
- Requires authentication via `authenticateToken` middleware
- Returns 404 if user not found
- Returns 401 if not authenticated

**POST /api/users/profile/avatar:**
- Secure file upload for user avatar images
- Multi-layer validation:
  1. MIME type check (Multer fileFilter): accepts only `image/jpeg`, `image/png`, `image/webp`
  2. Magic byte validation (file-type library): reads actual file content to verify it's truly an image
  3. File size limit: 5MB maximum
- UUID filenames via `crypto.randomUUID()` prevent path traversal attacks
- Uploads to `./uploads/avatars` directory (created automatically if missing)
- On success: saves URL to database via `User.updateAvatarUrl(userId, avatarUrl)`
- Returns JSON: `{ avatarUrl: "/uploads/avatars/uuid.jpg" }`
- Error handling:
  - Invalid MIME type → 400 with clear message
  - Failed magic byte check → 400, deletes uploaded file
  - File too large → 400 "File too large (max 5MB)"
  - Server error → 500, cleans up file if exists

### Security Features

1. **MIME Type Validation:** Multer fileFilter rejects non-image MIME types before file is written to disk
2. **Magic Byte Validation:** file-type library reads file header bytes to confirm actual file type matches MIME (prevents uploading .exe renamed as .jpg)
3. **UUID Filenames:** Uses `crypto.randomUUID()` instead of user-controlled filenames, prevents directory traversal (e.g., ../../etc/passwd.jpg)
4. **File Size Limits:** Hard 5MB cap enforced by Multer
5. **Authentication Required:** All profile routes protected by `authenticateToken` middleware
6. **File Cleanup:** Failed uploads are deleted from disk to prevent storage abuse

### Static File Serving

- Added `app.use('/uploads', express.static('uploads'))` to server.ts
- Uploaded avatars accessible at `/uploads/avatars/filename.jpg`
- Placed before API routes for proper middleware ordering

### Infrastructure

- Created `./uploads/avatars` directory on server start (using `mkdirSync({ recursive: true })`)
- Added `uploads/` to `.gitignore` to avoid committing user-uploaded files
- Used ESM import syntax (`readFileSync`, `unlinkSync`, etc.) for Node.js compatibility

## Task Breakdown

### Task 1: Install upload dependencies (commit: 45e8bc2)
- Installed `multer@2.0.2` (secure version, no CVE issues)
- Installed `file-type@21.3.0` for magic byte validation
- Installed `@types/multer` for TypeScript support
- **Duration:** <1 min

### Task 2: Profile API routes with avatar upload (commit: 7c330f2)
- Created `backend/src/routes/profile.ts` with GET and POST endpoints
- Updated `backend/src/server.ts` to mount profile router and static serving
- Added `uploads/` to `.gitignore`
- Verified all endpoints work correctly:
  - GET profile returns stats with calculated accuracy
  - POST avatar accepts valid images, rejects invalid files
  - File size limit enforced
  - Avatar URL persisted to database
  - Static serving works
- **Duration:** ~4 min

## Verification Results

All verification criteria passed:

✅ Backend compiles without errors (profile.ts uses proper ESM imports)
✅ GET /api/users/profile returns stats for authenticated user
✅ GET /api/users/profile returns 401 for unauthenticated request
✅ POST /api/users/profile/avatar accepts JPEG/PNG/WebP under 5MB
✅ POST /api/users/profile/avatar rejects non-image files (magic byte check)
✅ Uploaded avatar accessible at /uploads/avatars/filename
✅ Avatar URL persisted in database (verified via subsequent GET request)

### Test Results

```bash
# GET profile (authenticated) - ✅ Works
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/users/profile
→ {"totalXp":0,"totalGems":0,"gamesPlayed":0,"bestScore":0,"overallAccuracy":0,"avatarUrl":null,"name":"Test User","email":"test@example.com"}

# GET profile (unauthenticated) - ✅ Returns 401
curl http://localhost:3000/api/users/profile
→ {"error":"Access token required"}

# POST avatar (valid JPEG) - ✅ Works
curl -X POST -H "Authorization: Bearer <token>" -F "avatar=@test-avatar.jpg" http://localhost:3000/api/users/profile/avatar
→ {"avatarUrl":"/uploads/avatars/3d77cfda-8092-4cce-8f2c-a764cbe57aca.jpg"}

# POST avatar (invalid file) - ✅ Rejects with magic byte validation
curl -X POST -H "Authorization: Bearer <token>" -F "avatar=@fake.jpg" http://localhost:3000/api/users/profile/avatar
→ {"error":"Invalid file type. File content does not match allowed image types."}

# POST avatar (>5MB) - ✅ Rejects with size limit
curl -X POST -H "Authorization: Bearer <token>" -F "avatar=@large.jpg" http://localhost:3000/api/users/profile/avatar
→ {"error":"File too large (max 5MB)"}

# Static serving - ✅ Works
curl -I http://localhost:3000/uploads/avatars/3d77cfda-8092-4cce-8f2c-a764cbe57aca.jpg
→ HTTP/1.1 200 OK

# Avatar persisted - ✅ Works
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/users/profile
→ {"avatarUrl":"/uploads/avatars/3d77cfda-8092-4cce-8f2c-a764cbe57aca.jpg",...}
```

## Success Criteria

All success criteria met:

✅ Profile endpoint returns totalXp, totalGems, gamesPlayed, bestScore, overallAccuracy, avatarUrl, name, email
✅ Accuracy calculated as whole number percentage (0 if no games played)
✅ Avatar upload validates both MIME type and magic bytes
✅ Upload uses UUID filenames (no user-controlled paths)
✅ File size limited to 5MB
✅ Uploads directory created automatically, gitignored

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| ID | Decision | Rationale | Impact |
|----|----------|-----------|--------|
| multer-2.0 | Use Multer 2.0.2 specifically | Avoids CVE-2025-47935 and CVE-2025-47944 in Multer 1.x | Security improvement, no functional changes |
| magic-byte-validation | Validate file content, not just MIME type | Prevents uploading malicious files disguised as images | Defense in depth, catches MIME type spoofing |
| uuid-filenames | Use crypto.randomUUID for filenames | Prevents path traversal attacks (e.g., ../../etc/passwd.jpg) | Security hardening, predictable URL structure |
| 5mb-limit | Limit avatar uploads to 5MB | Reasonable balance between quality and storage/bandwidth | Users can upload high-quality avatars without abuse |

## Integration Points

### Consumed (from 05-01)
- `User.getProfileStats(id)`: Fetches totalXp, totalGems, gamesPlayed, bestScore, totalCorrect, totalQuestions, avatarUrl
- `User.updateAvatarUrl(id, avatarUrl)`: Persists avatar URL to database
- `authenticateToken`: Middleware protecting all profile routes

### Provided (for 05-04)
- **GET /api/users/profile**: Frontend can fetch user stats for display
- **POST /api/users/profile/avatar**: Frontend can upload avatar images
- **Static serving**: Uploaded avatars accessible at `/uploads/avatars/filename`

### Data Flow
1. Frontend sends GET request to `/api/users/profile` with Bearer token
2. Backend extracts userId from token, fetches stats from database
3. Backend calculates accuracy percentage from totalCorrect/totalQuestions
4. Returns stats + name + email to frontend

Avatar upload flow:
1. Frontend sends POST with multipart form data (avatar field)
2. Multer validates MIME type, writes to disk with UUID filename
3. Backend reads file, validates magic bytes with file-type
4. If valid: constructs URL, updates database, returns URL
5. If invalid: deletes file, returns 400 error

## Next Phase Readiness

**Plan 05-04 (Profile Page Frontend) can now proceed:**
- Profile API provides all data needed for display
- Avatar upload endpoint ready for integration
- Static serving allows displaying uploaded avatars
- No blockers

**Readiness: 100%**

## Technical Notes

### ESM Import Pattern
Used named imports instead of default imports for Node.js built-ins:
```typescript
import { readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { extname } from 'path';
```
This works with `"type": "module"` and `"moduleResolution": "NodeNext"` in tsconfig.json.

### Accuracy Calculation
Implemented as specified:
```typescript
const overallAccuracy = stats.totalQuestions > 0
  ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
  : 0;
```
Returns whole number percentage. Returns 0 if user has never played (avoids division by zero).

### Error Handler Middleware
Multer errors handled via custom error middleware:
```typescript
router.use((error: Error, _req: Request, res: Response, _next: any) => {
  if (error instanceof MulterError) {
    // Handle LIMIT_FILE_SIZE, LIMIT_UNEXPECTED_FILE, etc.
  }
  if (error.message.includes('Invalid file type')) {
    // Handle fileFilter rejections
  }
  res.status(500).json({ error: 'Upload error' });
});
```

### File Cleanup
Implemented defensive file cleanup on errors:
```typescript
catch (error) {
  if (req.file && existsSync(req.file.path)) {
    unlinkSync(req.file.path); // Delete uploaded file
  }
  res.status(500).json({ error: 'Failed to upload avatar' });
}
```

## Performance Notes

- Magic byte validation adds minimal overhead (<10ms for typical avatar files)
- Static file serving via Express is efficient for small files (<5MB)
- UUID generation is fast (uses crypto module)
- No database queries in static serving path

## Files Changed

### Created
- `backend/src/routes/profile.ts` (168 lines): Profile API routes with GET stats and POST avatar endpoints

### Modified
- `backend/src/server.ts`: Added profile router mount, static serving for uploads
- `.gitignore`: Added `uploads/` to ignore user-uploaded files
- `backend/package.json`: Added multer@2.0.2, file-type@21.3.0
- `backend/package-lock.json`: Dependency lockfile updated

## Commits

1. **45e8bc2** - `chore(05-03): install multer and file-type for avatar uploads`
   - Added multer@2.0.2, file-type@21.3.0, @types/multer

2. **7c330f2** - `feat(05-03): add profile API with secure avatar upload`
   - Implemented GET /api/users/profile
   - Implemented POST /api/users/profile/avatar with security validations
   - Added static serving for uploads
   - Updated .gitignore

---

**Status:** ✅ Complete
**Blockers:** None
**Next:** Execute 05-04-PLAN.md (Profile Page Frontend)
