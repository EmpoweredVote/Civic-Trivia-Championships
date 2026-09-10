import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend root
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const _requiredForXp = ['TRIVIA_SERVICE_KEY', 'EMPOWERED_ACCOUNTS_API_URL'];
const _missing = _requiredForXp.filter(k => !process.env[k]);
if (_missing.length > 0) {
  console.warn(`[env] Missing env vars (XP awards will be skipped): ${_missing.join(', ')}`);
}

const _requiredForAccounts = ['EMPOWERED_ACCOUNTS_URL'];
const _missingAccounts = _requiredForAccounts.filter(k => !process.env[k]);
if (_missingAccounts.length > 0) {
  console.warn(`[env] Missing env vars (Connected tier checks will fail — all users appear non-Connected): ${_missingAccounts.join(', ')}`);
}

const _requiredForGems = ['TRIVIA_GEMS_KEY'];
const _missingGems = _requiredForGems.filter(k => !process.env[k]);
if (_missingGems.length > 0) {
  console.warn(`[env] Missing env vars (gem awards will be skipped): ${_missingGems.join(', ')}`);
}

// WorkOS AuthKit — optional second token issuer (ev-accounts decision 0002).
// The auth middleware fails open to Supabase-only when WORKOS_CLIENT_ID is
// unset, so this is a warning, not a hard error. It matters because a missing
// or mismatched value silently rejects every WorkOS token — breaking admin
// access and all authenticated calls for WorkOS-session users. Surface the
// active mode at startup so a bad deploy is visible in the logs.
if (process.env.WORKOS_CLIENT_ID) {
  const _workosIssuer =
    process.env.WORKOS_ISSUER ??
    `https://api.workos.com/user_management/${process.env.WORKOS_CLIENT_ID}`;
  console.log(`[env] WorkOS issuer enabled — accepting tokens from ${_workosIssuer}`);
} else {
  console.warn('[env] WORKOS_CLIENT_ID unset — Supabase-only auth; WorkOS tokens will be rejected');
}
