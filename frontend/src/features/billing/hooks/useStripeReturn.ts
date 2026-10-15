import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { verifySession } from '../api';

const WELCOME_MS = 5000;

interface StripeReturnOptions {
  /** Called once the membership is confirmed (the layout refreshes the subscription). */
  onActivated?: () => void;
}

interface StripeReturn {
  welcome: boolean;
  dismiss: () => void;
}

/**
 * Handles the page Stripe sends the customer back to
 * (``?success=true&plan=...&session_id=...``): the session is verified with the
 * server (the webhook may not have arrived yet), the query string is removed and
 * ``welcome`` turns true for a few seconds.
 */
export function useStripeReturn({ onActivated }: StripeReturnOptions): StripeReturn {
  const location = useLocation();
  const navigate = useNavigate();
  const [welcome, setWelcome] = useState(false);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success') !== 'true' || !params.get('plan')) return;

    const sessionId = params.get('session_id');
    const key = sessionId || 'no-session';
    if (handled.current === key) return;
    handled.current = key;

    navigate(location.pathname, { replace: true });

    const welcomeUser = () => {
      setWelcome(true);
      if (onActivated) onActivated();
    };

    (async () => {
      if (!sessionId) {
        welcomeUser();
        return;
      }
      try {
        const result = await verifySession(sessionId);
        if (result.has_subscription) welcomeUser();
        // otherwise the payment is not completed yet: nothing to celebrate
      } catch (error) {
        // the webhook may have activated the subscription already
        welcomeUser();
      }
    })();
  }, [location.search, location.pathname, navigate, onActivated]);

  useEffect(() => {
    if (!welcome) return undefined;
    const timer = setTimeout(() => setWelcome(false), WELCOME_MS);
    return () => clearTimeout(timer);
  }, [welcome]);

  return { welcome, dismiss: () => setWelcome(false) };
}
