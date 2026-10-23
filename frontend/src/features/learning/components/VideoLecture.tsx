import React from 'react';
import { Captions, Clock, Eye, PlayCircle, Youtube } from 'lucide-react';

import type { UUID } from '../../../shared/types';
import { formatClock } from '../../../shared/lib/time';
import { Badge } from '../../../shared/ui/Badge';
import { useWatchReporter } from '../hooks/usePlayer';
import { youTubeVideoId } from '../lib/youtube';
import type { PlayerVideoLecture } from '../types';
import HostedVideo from './HostedVideo';
import YouTubeEmbed from './YouTubeEmbed';

interface VideoLectureProps {
  courseId: UUID;
  lecture: PlayerVideoLecture;
}

/**
 * A video lecture: YouTube embed or a hosted file with optional subtitles.  Where the student is
 * in the video is reported to the server (so it resumes and the learning hours are real).
 */
const VideoLecture = ({ courseId, lecture }: VideoLectureProps) => {
  const subtitles = lecture.subtitles || [];
  const report = useWatchReporter({ courseId, lectureId: lecture.id });
  const youTubeId = lecture.video_type === 'youtube' ? youTubeVideoId(lecture.video_url) : null;
  const resumeAt = lecture.last_watched_position || 0;

  return (
    <div className="space-y-3">
      <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-card ring-1 ring-line">
        {youTubeId ? (
          <YouTubeEmbed key={lecture.id} lecture={lecture} videoId={youTubeId} resumeAt={resumeAt} onReport={report} />
        ) : lecture.video_file_url ? (
          <HostedVideo key={lecture.id} lecture={lecture} resumeAt={resumeAt} onReport={report} />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface-muted">
            <div className="text-center">
              <PlayCircle className="mx-auto mb-2 h-12 w-12 text-fg-subtle" aria-hidden="true" />
              <p className="text-sm text-fg-muted">Video content not available</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {lecture.duration > 0 && (
            <Badge icon={Clock}>Duration: {formatClock(lecture.duration)}</Badge>
          )}
          <Badge icon={lecture.video_type === 'youtube' ? Youtube : PlayCircle}>
            {lecture.video_type === 'youtube' ? 'YouTube Video' : 'Hosted Video'}
          </Badge>
          {subtitles.length > 0 && (
            <Badge icon={Captions} tone="primary">
              Subtitles: {subtitles.map((subtitle) => subtitle.language_name).join(', ')}
            </Badge>
          )}
        </div>
        <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <Eye size={14} aria-hidden="true" />
          Watched {lecture.watch_count} time{lecture.watch_count !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};

export default VideoLecture;
