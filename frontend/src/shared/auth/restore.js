import { session } from '../lib/session';
import * as accountsApi from './api';

let restoring = null;

async function restore() {
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
    if (error.response && error.response.status === 401) {
      session.setAnonymous();
    } else {
      session.setUnavailable(); // the session is not known to be over
    }
  }
}

/** Find out from the server who is signed in (the answer lands in the session store). */
export function restoreSession() {
  if (!restoring) {
    restoring = restore().finally(() => {
      restoring = null;
    });
  }
  return restoring;
}
