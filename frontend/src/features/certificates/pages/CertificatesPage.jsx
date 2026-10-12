import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

import { formatDate } from '../../../shared/lib/time';
import { PageSpinner } from '../../../shared/ui/Spinner';
import * as certificatesApi from '../api';

const CertificatesPage = () => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    certificatesApi
      .fetchCertificates()
      .then((rows) => !cancelled && setCertificates(rows))
      .catch(() => !cancelled && setCertificates([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <PageSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">My Certificates</h1>
        <p className="text-indigo-100">Your earned certificates and credentials</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {certificates.map((cert) => (
          <div key={cert.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{cert.course_title}</h3>
              <p className="text-sm text-gray-600">by {cert.instructor}</p>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Issued:</span>
                <span className="font-medium">{formatDate(cert.issue_date)}</span>
              </div>
              {cert.grade !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Grade:</span>
                  <span className="font-medium text-green-600">{cert.grade}%</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Credential ID:</span>
                <span className="font-mono text-xs">{cert.certificate_id}</span>
              </div>
            </div>

            <a
              href={cert.verification_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center"
            >
              <ExternalLink size={16} className="mr-2" />
              Verify Certificate
            </a>
          </div>
        ))}
      </div>

      {certificates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No certificates yet</h3>
          <p className="text-gray-600">Complete courses to earn your first certificate!</p>
        </div>
      )}
    </div>
  );
};

export default CertificatesPage;
