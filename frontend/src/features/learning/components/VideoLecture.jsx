import React from 'react';
import { PlayCircle } from 'lucide-react';

import { formatClock } from '../../../shared/lib/time';
import { useWatchReporter } from '../hooks/usePlayer';
import { youTubeVideoId } from '../lib/youtube';
import HostedVideo from './HostedVideo';
import YouTubeEmbed from './YouTubeEmbed';

/**
 * A video lecture: YouTube embed or a hosted file with optional subtitles.  Where the student is
 * in the video is reported to the server (so it resumes and the learning hours are real).
 */
const VideoLecture = ({ courseId, lecture }) => {
  const subtitles = lecture.subtitles || [];
  const report = useWatchReporter({ courseId, lectureId: lecture.id });
  const youTubeId = lecture.video_type === 'youtube' ? youTubeVideoId(lecture.video_url) : null;
  const resumeAt = lecture.last_watched_position || 0;

  return (
    <div className="p-4 sm:p-6">
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
        {youTubeId ? (
          <YouTubeEmbed key={lecture.id} lecture={lecture} videoId={youTubeId} resumeAt={resumeAt} onReport={report} />
        ) : lecture.video_file_url ? (
          <HostedVideo key={lecture.id} lecture={lecture} resumeAt={resumeAt} onReport={report} />
        ) : (
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <PlayCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p className="text-gray-500">Video content not available</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          {lecture.duration > 0 && <span>Duration: {formatClock(lecture.duration)}</span>}
          <span className="capitalize">
            {lecture.video_type === 'youtube' ? 'YouTube Video' : 'Local Video'}
          </span>
          {subtitles.length > 0 && (
            <span className="text-blue-600">
              Subtitles: {subtitles.map((subtitle) => subtitle.language_name).join(', ')}
            </span>
          )}
        </div>
        <span>
          Watched {lecture.watch_count} time{lecture.watch_count !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};

export default VideoLecture;
