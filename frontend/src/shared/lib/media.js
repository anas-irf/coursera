import { API_ORIGIN } from '../config';

/**
 * Absolute URL of a file the backend serves.
 *
 * The API returns media paths such as "/media/course_thumbnails/a.png"; those only
 * resolve on the API host, not on the host serving the frontend.
 */
export function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}
