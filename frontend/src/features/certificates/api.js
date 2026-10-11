import api from '../../shared/api/client';

export const fetchCertificates = () =>
  api.get('/certificates/').then((response) => response.data);
