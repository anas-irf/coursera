import { lectureFormData } from './api';
import type { AssignmentSettings, QuizQuestion, QuizSettings } from './types';

const entries = (formData: FormData) => Array.from(formData.entries());

test('plain fields are sent as they are and empty ones are skipped', () => {
  const formData = lectureFormData({
    title: 'Intro',
    content_type: 'video',
    video_url: '',
    description: null,
    order: undefined,
  });

  expect(entries(formData)).toEqual([
    ['title', 'Intro'],
    ['content_type', 'video'],
    ['video_url', ''],
  ]);
});

test('files travel under their own names', () => {
  const video = new File(['v'], 'clip.mp4', { type: 'video/mp4' });
  const subtitle = new File(['s'], 'clip.vtt', { type: 'text/vtt' });

  const formData = lectureFormData({ title: 'Video', video_file: video, subtitle_file: subtitle });

  expect(formData.get('video_file')).toBe(video);
  expect(formData.get('subtitle_file')).toBe(subtitle);
});

test('questions and settings are JSON strings', () => {
  const questions = [
    { question_text: 'Capital of France?', options: [{ option_text: 'Paris', is_correct: true }] },
  ] as QuizQuestion[];
  const formData = lectureFormData({
    title: 'Quiz',
    questions,
    quiz_settings: { passing_score: 70, weight: 20 } as QuizSettings,
  });

  expect(JSON.parse(formData.get('questions') as string)).toEqual(questions);
  expect(JSON.parse(formData.get('quiz_settings') as string)).toEqual({ passing_score: 70, weight: 20 });
});

test('an assignment attachment is its own part and not part of the settings JSON', () => {
  const attachment = new File(['a'], 'brief.pdf', { type: 'application/pdf' });

  const formData = lectureFormData({
    title: 'Assignment',
    assignment_settings: { max_points: 100, attachment } as AssignmentSettings,
  });

  expect(formData.get('attachment')).toBe(attachment);
  expect(JSON.parse(formData.get('assignment_settings') as string)).toEqual({ max_points: 100 });
});

test('existing attachment urls stay inside the settings', () => {
  const formData = lectureFormData({
    title: 'Assignment',
    assignment_settings: {
      max_points: 100,
      existing_attachment: '/media/lectures/assignments/brief.pdf',
    } as AssignmentSettings,
  });

  expect(formData.get('attachment')).toBeNull();
  expect(JSON.parse(formData.get('assignment_settings') as string).existing_attachment).toBe(
    '/media/lectures/assignments/brief.pdf'
  );
});
