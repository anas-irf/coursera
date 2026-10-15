import React from 'react';
import { BookOpen } from 'lucide-react';

import { mediaUrl } from '../lib/media';

/**
 * A course's picture; a course without one gets a local placeholder (no request to a third
 * party, and the page works offline).
 */
export function CourseThumbnail({ course, className = 'w-full h-40 object-cover' }) {
  const src = mediaUrl(course.thumbnail);
  if (src) {
    return <img src={src} alt={course.title} className={className} />;
  }
  return (
    <div
      role="img"
      aria-label={course.title}
      className={`${className} flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600`}
    >
      <BookOpen className="text-white opacity-80" size={36} />
    </div>
  );
}

export default CourseThumbnail;
