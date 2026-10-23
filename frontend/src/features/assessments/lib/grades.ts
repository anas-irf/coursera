import type { GradebookCourse } from '../types';

/** Pure helpers of the learner's gradebook. */

/** The tone a grade is drawn in (the names of the UI kit's tones). */
export type GradeTone = 'success' | 'primary' | 'warning' | 'danger';

export interface GradeBand {
  tone: GradeTone;
}

interface Band {
  from: number;
  tone: GradeTone;
}

const BANDS: Band[] = [
  { from: 90, tone: 'success' },
  { from: 80, tone: 'primary' },
  { from: 60, tone: 'warning' },
];

const BELOW: GradeBand = { tone: 'danger' };

/** The tone of a grade: 90+ success, 80+ primary, 60+ warning, below that danger. */
export function gradeBand(grade: number): GradeBand {
  const band = BANDS.find((candidate) => grade >= candidate.from);
  return band ? { tone: band.tone } : BELOW;
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

/** Narrows a value handed over as text (a select, a URL) to the filter it stands for. */
export function isGradeFilter(value: string): value is GradeFilter {
  return value === 'all' || value === 'passing' || value === 'failing';
}

/** The courses that match the filter: "all", "passing" or "failing". */
export function filterCourses<T extends Pick<GradebookCourse, 'is_passing'>>(courses: T[], filter: GradeFilter): T[] {
  if (filter === 'passing') return courses.filter((course) => course.is_passing);
  if (filter === 'failing') return courses.filter((course) => !course.is_passing);
  return courses;
}
