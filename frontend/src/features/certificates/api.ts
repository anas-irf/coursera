import api from '../../shared/api/client';
import type { Certificate, CertificateVerification } from './types';

export const fetchCertificates = (): Promise<Certificate[]> =>
  api.get<Certificate[]>('/certificates/').then((response) => response.data);

/** The public facts of a certificate, by the code of its verification link (anybody may ask). */
export const verifyCertificate = (code: string): Promise<CertificateVerification> =>
  api
    .get<CertificateVerification>(`/certificates/verify/${encodeURIComponent(code)}/`)
    .then((response) => response.data);
