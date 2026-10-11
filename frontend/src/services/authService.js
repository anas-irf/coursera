// Legacy adapter for the dashboards that have not been moved to the auth
// provider yet.  New code uses ``useAuth`` from app/AuthProvider.
import * as accountsApi from '../features/accounts/api';
import { session } from '../shared/lib/session';

const authService = {
  getCurrentUser: () => session.getUser(),
  getUserType: () => (session.getUser() ? session.getUser().user_type : null),
  isAuthenticated: () => session.isAuthenticated(),

  logout: async () => {
    const refresh = session.getRefreshToken();
    try {
      if (refresh) await accountsApi.logout(refresh);
    } catch (error) {
      // cleared below either way
    }
    session.clear();
  },
};

export default authService;
