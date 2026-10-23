import { useMutation } from '@tanstack/react-query';

import { useAuth } from '../../../shared/auth/AuthProvider';
import * as accountsApi from '../api';
import type { PasswordChange, ProfileChanges } from '../types';

/** Save the profile; the session takes the user the server answers (the header shows the new name). */
export function useUpdateProfile() {
  const { updateIdentity } = useAuth();
  return useMutation({
    mutationFn: (changes: ProfileChanges) => accountsApi.updateProfile(changes),
    onSuccess: (identity) => updateIdentity(identity),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (body: PasswordChange) => accountsApi.changePassword(body) });
}
