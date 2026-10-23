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
  /** The public page of the app on which anybody can check the certificate (``/verify/<code>``). */
  verification_url: string;
  /** The final grade in percent, ``null`` when the course was not graded. */
  grade: number | null;
  thumbnail: string | null;
}

/**
 * ``GET /certificates/verify/<code>/``: what anybody holding the verification code may see of the
 * certificate (no login).  An unknown code is a 404.
 */
export interface CertificateVerification {
  /** The number printed on the certificate ("CERT-..."). */
  certificate_number: string;
  verification_code: string;
  student_name: string;
  course_title: string;
  instructor: string;
  issue_date: ISODateTime;
  /** The final grade in percent, ``null`` when the course was not graded. */
  grade: number | null;
  /** The hours the course is estimated to take, ``null`` when it does not say. */
  course_hours: number | null;
}
