import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

import { cn } from '../lib/cn';
import { mediaUrl } from '../lib/media';

interface CourseThumbnailProps {
  /** What is drawn of a course: any record with a title and, perhaps, a picture. */
  course: { title: string; thumbnail?: string | null };
  className?: string;
}

/**
 * A course's picture; a course without one (or whose file cannot be loaded) gets a local
 * placeholder in the brand colours: no request to a third party, and the page works offline.
 */
export function CourseThumbnail({ course, className = 'h-40 w-full' }: CourseThumbnailProps) {
  const src = mediaUrl(course.thumbnail);
  const [broken, setBroken] = useState(false);

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={course.title}
        loading="lazy"
        onError={() => setBroken(true)}
        className={cn('bg-surface-muted object-cover', className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={course.title}
      className={cn('flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-800', className)}
    >
      <BookOpen className="text-white/80" size={32} aria-hidden="true" />
    </div>
  );
}

export default CourseThumbnail;
