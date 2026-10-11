// SAMPLE DATA.
//
// The backend has no revenue figures, subscriber statistics or report
// generation yet.  These screens show the numbers below so the layout can be
// reviewed; every page that uses them says so on screen.

export const SAMPLE_REVENUE = {
  stats: {
    total_revenue: 245000,
    monthly_growth: 12.5,
    total_subscriptions: 8934,
    avg_revenue_per_user: 27.44
  },
  revenue_chart: [
    { month: 'Jan', revenue: 85000, subscriptions: 7200, courses_sold: 1200 },
    { month: 'Feb', revenue: 92000, subscriptions: 7800, courses_sold: 1350 },
    { month: 'Mar', revenue: 105000, subscriptions: 8200, courses_sold: 1500 },
    { month: 'Apr', revenue: 118000, subscriptions: 8600, courses_sold: 1680 },
    { month: 'May', revenue: 125000, subscriptions: 8934, courses_sold: 1820 },
    { month: 'Jun', revenue: 142000, subscriptions: 9500, courses_sold: 2100 }
  ],
  top_courses: [
    { name: 'Machine Learning Basics', revenue: 45000, enrollments: 1500 },
    { name: 'Web Development', revenue: 38000, enrollments: 1200 },
    { name: 'Data Science', revenue: 32000, enrollments: 980 },
    { name: 'Mobile Development', revenue: 28000, enrollments: 850 },
    { name: 'Cloud Computing', revenue: 22000, enrollments: 720 }
  ]
};

export const SAMPLE_REPORTS = {
  available_reports: [
    {
      id: 1,
      name: 'Monthly User Activity Report',
      description: 'Detailed breakdown of user engagement and activity metrics',
      type: 'user_activity',
      last_generated: '2024-01-15',
      file_size: '2.4 MB',
      format: 'PDF'
    },
    {
      id: 2,
      name: 'Course Performance Analytics',
      description: 'Analysis of course completion rates, ratings, and enrollment trends',
      type: 'course_performance',
      last_generated: '2024-01-14',
      file_size: '3.1 MB',
      format: 'Excel'
    },
    {
      id: 3,
      name: 'Revenue & Financial Summary',
      description: 'Comprehensive financial overview including revenue, subscriptions, and growth metrics',
      type: 'financial',
      last_generated: '2024-01-13',
      file_size: '1.8 MB',
      format: 'PDF'
    },
    {
      id: 4,
      name: 'Instructor Performance Report',
      description: 'Metrics on instructor engagement, course quality, and student feedback',
      type: 'instructor_performance',
      last_generated: '2024-01-12',
      file_size: '2.7 MB',
      format: 'PDF'
    },
    {
      id: 5,
      name: 'Platform Usage Statistics',
      description: 'Technical metrics including page views, session duration, and feature usage',
      type: 'platform_usage',
      last_generated: '2024-01-11',
      file_size: '4.2 MB',
      format: 'Excel'
    },
    {
      id: 6,
      name: 'Content Quality Assessment',
      description: 'Review of course content quality, user feedback, and improvement recommendations',
      type: 'content_quality',
      last_generated: '2024-01-10',
      file_size: '3.5 MB',
      format: 'PDF'
    }
  ]
};

export const SAMPLE_NOTICE = 'Sample data: this section is not connected to real figures yet.';
