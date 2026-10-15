export { default as CourseCard } from './components/CourseCard';
export { default as EnrolledCourseCard } from './components/EnrolledCourseCard';
export { default as ExplorePage } from './pages/ExplorePage';
export { default as MyLearningPage } from './pages/MyLearningPage';
export { default as CoursePlayerPage } from './pages/CoursePlayerPage';
export { default as InstructorStudentsPage } from './pages/InstructorStudentsPage';
export { useMyCourses, useRecommendedCourses } from './hooks/useLearning';

// what the exported cards and hooks take and answer
export type { CatalogCourse, EnrolledCourse, EnrolledView } from './types';
