import type { GradebookCourse } from '../types';

/** Pure helpers of the learner's gradebook. */

interface Band {
  from: number;
  text: string;
  bg: string;
}

/** The Tailwind classes of a grade. */
export interface GradeColours {
  text: string;
  bg: string;
}

const BANDS: Band[] = [
  { from: 90, text: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  { from: 80, text: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { from: 70, text: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  { from: 60, text: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
];

const BELOW: GradeColours = { text: 'text-red-600', bg: 'bg-red-50 border-red-200' };

/** The colours of a grade: ``{text, bg}`` for 90+, 80+, 70+, 60+ and below. */
export function gradeBand(grade: number): GradeColours {
  const band = BANDS.find((candidate) => grade >= candidate.from);
  return band ? { text: band.text, bg: band.bg } : BELOW;
}

/** What the figures of a gradebook need of a course. */
type GradedCourse = Pick<GradebookCourse, 'final_grade' | 'is_passing'>;

export interface GradebookStats {
  totalCourses: number;
  passingCourses: number;
  average: number;
  successRate: number;
}

/** Average grade, courses passing and the success rate over the courses of a gradebook. */
export function gradebookStats(courses: GradedCourse[]): GradebookStats {
  const total = courses.length;
  const passing = courses.filter((course) => course.is_passing).length;
  const sum = courses.reduce((acc, course) => acc + course.final_grade, 0);

  return {
    totalCourses: total,
    passingCourses: passing,
    average: total > 0 ? sum / total : 0,
    successRate: total > 0 ? (passing / total) * 100 : 0,
  };
}

/** The filter of the course list. */
export type GradeFilter = 'all' | 'passing' | 'failing';

/** Narrows the value of the filter ``<select>`` (a string) to the filter it stands for. */
export function isGradeFilter(value: string): value is GradeFilter {
  return value === 'all' || value === 'passing' || value === 'failing';
}

/** The courses that match the filter: "all", "passing" or "failing". */
export function filterCourses<T extends Pick<GradebookCourse, 'is_passing'>>(courses: T[], filter: GradeFilter): T[] {
  if (filter === 'passing') return courses.filter((course) => course.is_passing);
  if (filter === 'failing') return courses.filter((course) => !course.is_passing);
  return courses;
}
