import React, { useState } from 'react';
import { FileText, Download, Calendar, BarChart2, PieChart, TrendingUp } from 'lucide-react';
import { useToast } from '../../../shared/ui/Toast';
import { SAMPLE_NOTICE, SAMPLE_REPORTS } from '../sampleData';

const ReportsPage = () => {
  const reports = SAMPLE_REPORTS.available_reports;
  const [filter, setFilter] = useState('all');
  const [generatingReport, setGeneratingReport] = useState(null);
  const { success } = useToast();

  const handleGenerateReport = async (reportId) => {
    setGeneratingReport(reportId);
    // demo only: nothing is generated yet
    await new Promise(resolve => setTimeout(resolve, 2000));
    setGeneratingReport(null);
    success('Demo only: no report file is produced yet.', 'Report Ready');
  };

  const handleDownloadReport = (reportId) => {
    // demo only
    success('Demo only: there is no file to download yet.', 'Download');
  };

  const getReportIcon = (type) => {
    switch (type) {
      case 'user_activity': return <BarChart2 className="text-blue-600" size={20} />;
      case 'course_performance': return <TrendingUp className="text-green-600" size={20} />;
      case 'financial': return <PieChart className="text-purple-600" size={20} />;
      case 'instructor_performance': return <BarChart2 className="text-orange-600" size={20} />;
      case 'platform_usage': return <TrendingUp className="text-indigo-600" size={20} />;
      case 'content_quality': return <PieChart className="text-red-600" size={20} />;
      default: return <FileText className="text-gray-600" size={20} />;
    }
  };

  const getFormatColor = (format) => {
    switch (format) {
      case 'PDF': return 'bg-red-100 text-red-800';
      case 'Excel': return 'bg-green-100 text-green-800';
      case 'CSV': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };


  const filteredReports = reports.filter(report => {
    if (filter === 'all') return true;
    return report.type === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-600 mt-1">{SAMPLE_NOTICE}</p>
        </div>

        <div className="flex items-center space-x-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Reports</option>
            <option value="user_activity">User Activity</option>
            <option value="course_performance">Course Performance</option>
            <option value="financial">Financial</option>
            <option value="instructor_performance">Instructor Performance</option>
            <option value="platform_usage">Platform Usage</option>
            <option value="content_quality">Content Quality</option>
          </select>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg mr-4">
              <FileText className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
              <p className="text-sm text-gray-600">Available Reports</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 bg-green-50 rounded-lg mr-4">
              <Download className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">142</p>
              <p className="text-sm text-gray-600">Downloads This Month</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 bg-purple-50 rounded-lg mr-4">
              <Calendar className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">Daily</p>
              <p className="text-sm text-gray-600">Auto-Generation</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 bg-orange-50 rounded-lg mr-4">
              <TrendingUp className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">98.5%</p>
              <p className="text-sm text-gray-600">Report Accuracy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => (
          <div key={report.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-50 rounded-lg mr-3">
                    {getReportIcon(report.type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{report.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getFormatColor(report.format)}`}>
                  {report.format}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-500">Last Generated</p>
                  <p className="font-medium text-gray-900">{new Date(report.last_generated).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">File Size</p>
                  <p className="font-medium text-gray-900">{report.file_size}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Calendar size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Updated {new Date(report.last_generated).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDownloadReport(report.id)}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Download size={16} />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={() => handleGenerateReport(report.id)}
                    disabled={generatingReport === report.id}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
                  >
                    {generatingReport === report.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <FileText size={16} />
                        <span>Generate New</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
          <p className="text-gray-500">
            {filter !== 'all'
              ? 'Try selecting a different report type.'
              : 'No reports are available at this time.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;