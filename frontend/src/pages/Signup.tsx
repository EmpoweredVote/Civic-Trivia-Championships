import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { track } from '@empoweredvote/analytics';
import { ACCOUNTS_WEB_URL } from '../services/accountsApi';

/**
 * Redirects new users to the Empowered Accounts signup page.
 * After account creation and email confirmation, accounts.empowered.vote
 * redirects back to CTC at the `redirect` URL.
 */
export function Signup() {
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');

  // Redirect target after signup: honour `from` param, default to /play
  const postSignupPath = from ?? '/play';
  const redirectUrl = `${window.location.origin}${postSignupPath}`;

  useEffect(() => {
    track('ctc_signup_started');
    window.location.href = `${ACCOUNTS_WEB_URL}/signup?redirect=${encodeURIComponent(redirectUrl)}`;
  }, [redirectUrl]);

  return null;
}
