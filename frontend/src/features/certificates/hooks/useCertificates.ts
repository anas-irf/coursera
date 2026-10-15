import { useQuery } from '@tanstack/react-query';

import { fetchCertificates } from '../api';

export const certificateKeys = {
  all: ['certificates'] as const,
};

/** The learner's certificates, newest first. */
export function useCertificates() {
  return useQuery({ queryKey: certificateKeys.all, queryFn: fetchCertificates });
}
