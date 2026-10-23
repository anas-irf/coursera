import api from '../../shared/api/client';
import type { Identity } from '../../shared/auth/types';
import type { PasswordChange, PasswordChanged, ProfileChanges } from './types';

/** Save the signed-in user's own details; answers the user and the profile as they are now. */
export const updateProfile = (changes: ProfileChanges): Promise<Identity> =>
  api.patch<Identity>('/auth/profile/', changes).then((response) => response.data);

/** Change the password (the current one is asked again); the session stays signed in. */
export const changePassword = (body: PasswordChange): Promise<PasswordChanged> =>
  api.post<PasswordChanged>('/auth/password/', body).then((response) => response.data);
