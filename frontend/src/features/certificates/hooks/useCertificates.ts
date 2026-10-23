import { useQuery } from '@tanstack/react-query';

import { fetchCertificates, verifyCertificate } from '../api';

export const certificateKeys = {
  all: ['certificates'] as const,
  mine: ['certificates', 'mine'] as const,
  verification: (code: string) => ['certificates', 'verify', code] as const,
};

/** The learner's certificates, newest first. */
export function useCertificates() {
  return useQuery({ queryKey: certificateKeys.mine, queryFn: fetchCertificates });
}

/**
 * The certificate a verification link points at.  It does not change once issued, so it is kept
 * for the visit; an unknown code is a 404, which is not retried.
 */
export function useCertificateVerification(code: string) {
  return useQuery({
    queryKey: certificateKeys.verification(code),
    queryFn: () => verifyCertificate(code),
    staleTime: Infinity,
  });
}
