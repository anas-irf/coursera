export { default as GradesPage } from './pages/GradesPage';
export { default as InstructorAssignmentsPage } from './pages/InstructorAssignmentsPage';
export { default as QuizRunner } from './components/QuizRunner';
export { default as AssignmentPanel } from './components/AssignmentPanel';

// the blocks of a player lecture that QuizRunner and AssignmentPanel read: the learning slice
// composes its lecture union from them
export type { AssignmentLecture, QuizLecture, StudentSubmission } from './types';
