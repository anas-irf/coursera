import type { ISODateTime, UUID } from '../../shared/types';

/** A certificate the learner earned: one row of ``GET /certificates/``. */
export interface Certificate {
  id: UUID;
  course_title: string;
  /** The instructor's name. */
  instructor: string;
  issue_date: ISODateTime;
  /** The number printed on the certificate ("the credential id"). */
  certificate_id: string;
  verification_url: string;
  /** The final grade in percent, ``null`` when the course was not graded. */
  grade: number | null;
  thumbnail: string | null;
}
