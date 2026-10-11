import api from '../../shared/api/client';

export const fetchCertificates = () =>
  api.get('/courses/student/certificates/').then((response) => response.data);
