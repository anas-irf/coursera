/** Pure helpers of the player payload (``GET learning/courses/<id>/learn/``). */
import type { UUID } from '../../../shared/types';
import type { PlayerLecture, PlayerPayload, PlayerSection, WatchProgress } from '../types';

/** Every lecture of the course in outline order. */
export const allLectures = (sections: PlayerSection[]): PlayerLecture[] =>
  sections.flatMap((section) => section.lectures);

/** The lecture to open when the student has no remembered place: the first one not finished. */
export const firstIncomplete = (sections: PlayerSection[]): PlayerLecture | null => {
  const lectures = allLectures(sections);
  return lectures.find((lecture) => !lecture.is_completed) || lectures[0] || null;
};

/** The player data with what the server answered to a watch heartbeat folded into the lecture. */
export const withWatchResult = (
  data: PlayerPayload | undefined,
  lectureId: UUID,
  result: WatchProgress | null | undefined
): PlayerPayload | undefined => {
  if (!data || !result) return data;
  return {
    ...data,
    sections: data.sections.map((section) => ({
      ...section,
      lectures: section.lectures.map((lecture) =>
        lecture.id === lectureId
          ? {
              ...lecture,
              last_watched_position: result.last_watched_position,
              progress_seconds: result.progress_seconds,
              watch_count: result.watch_count,
            }
          : lecture
      ),
    })),
  };
};

/** Seconds to seek to when a video opens, or 0 to start from the beginning. */
export const resumePosition = (position: number | null | undefined, duration?: number | null): number => {
  const at = Number(position) || 0;
  if (at < 5) return 0; // a few seconds in is "the beginning"
  if (duration && at > duration - 5) return 0; // nearly finished: start over
  return at;
};
