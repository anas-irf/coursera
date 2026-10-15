import api from '../../shared/api/client';
import type { Certificate } from './types';

export const fetchCertificates = (): Promise<Certificate[]> =>
  api.get<Certificate[]>('/certificates/').then((response) => response.data);
