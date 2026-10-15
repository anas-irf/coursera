import { errorStatus } from '../api/errors';
import { session } from '../lib/session';
import * as accountsApi from './api';

let restoring: Promise<void> | null = null;

async function restore(): Promise<void> {
  const legacy = session.legacyRefreshToken();
  if (!legacy && !session.hasHint()) {
    session.setAnonymous(); // a visitor: nothing to ask
    return;
  }

  if (legacy) {
    // once: the old session becomes cookies, and nothing is left in localStorage
    try {
      await accountsApi.exchangeLegacyToken(legacy);
    } catch (error) {
      // expired or refused: the user signs in again
    }
    session.dropLegacy();
  }

  try {
    const { user, profile } = await accountsApi.fetchProfile();
    session.start({ user, profile });
  } catch (error) {
    if (errorStatus(error) === 401) {
      session.setAnonymous();
    } else {
      session.setUnavailable(); // the session is not known to be over
    }
  }
}

/** Find out from the server who is signed in (the answer lands in the session store). */
export function restoreSession(): Promise<void> {
  if (!restoring) {
    restoring = restore().finally(() => {
      restoring = null;
    });
  }
  return restoring;
}
