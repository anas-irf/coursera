import type { PlayerPayload, PlayerSection, WatchProgress } from '../types';
import { allLectures, firstIncomplete, resumePosition, withWatchResult } from './player';

// outlines that hold only what the helpers read of a lecture
const sections = [
  { id: 's1', lectures: [{ id: 'a', is_completed: true }, { id: 'b', is_completed: false }] },
  { id: 's2', lectures: [{ id: 'c', is_completed: false }] },
] as PlayerSection[];

test('lectures are listed in outline order and the first unfinished one is the way in', () => {
  expect(allLectures(sections).map((lecture) => lecture.id)).toEqual(['a', 'b', 'c']);
  expect(firstIncomplete(sections)?.id).toBe('b');
});

test('a finished course opens on its first lecture; an empty one on nothing', () => {
  const done = [
    { id: 's', lectures: [{ id: 'a', is_completed: true }, { id: 'b', is_completed: true }] },
  ] as PlayerSection[];
  expect(firstIncomplete(done)?.id).toBe('a');
  expect(firstIncomplete([])).toBeNull();
});

test('a heartbeat answer is folded into its lecture and nothing else', () => {
  const data = {
    sections: [{ id: 's', lectures: [
      { id: 'a', last_watched_position: 0, progress_seconds: 0, watch_count: 0, title: 'A' },
      { id: 'b', last_watched_position: 7, progress_seconds: 9, watch_count: 1, title: 'B' },
    ] }],
  } as PlayerPayload;
  const answer: WatchProgress = {
    last_watched_position: 42, progress_seconds: 42, watch_count: 1, total_time_spent: 42,
  };

  const next = withWatchResult(data, 'a', answer);

  expect(next?.sections[0].lectures[0]).toEqual({
    id: 'a', title: 'A', last_watched_position: 42, progress_seconds: 42, watch_count: 1,
  });
  expect(next?.sections[0].lectures[1]).toBe(data.sections[0].lectures[1]);
  expect(data.sections[0].lectures[0].last_watched_position).toBe(0); // the old object is untouched
  expect(withWatchResult(undefined, 'a', answer)).toBeUndefined();
});

test('a video resumes where it stopped unless that is the very start or the very end', () => {
  expect(resumePosition(120, 600)).toBe(120);
  expect(resumePosition(3, 600)).toBe(0);
  expect(resumePosition(598, 600)).toBe(0);
  expect(resumePosition(120, 0)).toBe(120); // duration unknown
  expect(resumePosition(undefined, 600)).toBe(0);
});
