import { mediaUrl } from './media';

test('relative media paths are served by the API host', () => {
  expect(mediaUrl('/media/course_thumbnails/a.png')).toBe('http://localhost:8000/media/course_thumbnails/a.png');
  expect(mediaUrl('media/a.png')).toBe('http://localhost:8000/media/a.png');
});

test('absolute and inline urls are left alone', () => {
  expect(mediaUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
  expect(mediaUrl('blob:http://localhost:3000/abc')).toBe('blob:http://localhost:3000/abc');
  expect(mediaUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
});

test('nothing in, nothing out', () => {
  expect(mediaUrl(null)).toBeNull();
  expect(mediaUrl('')).toBeNull();
});
