import React from 'react';
import { PlayCircle } from 'lucide-react';

import { mediaUrl } from '../../../shared/lib/media';

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  /youtube\.com\/v\/([^&\n?#]+)/,
];

export const youTubeVideoId = (url) => {
  if (!url) return null;
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const formatDuration = (seconds) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

/** A video lecture: YouTube embed or a hosted file with optional subtitles. */
const VideoLecture = ({ lecture }) => {
  const subtitles = lecture.subtitles || [];

  return (
    <div className="p-4 sm:p-6">
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
        {lecture.video_type === 'youtube' && lecture.video_url ? (
          <iframe
            key={lecture.id}
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${youTubeVideoId(lecture.video_url)}?enablejsapi=1&rel=0&modestbranding=1`}
            title={lecture.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : lecture.video_file_url ? (
          <video
            key={lecture.id}
            controls
            crossOrigin="anonymous"
            className="w-full h-full"
            poster={mediaUrl(lecture.thumbnail) || undefined}
            preload="metadata"
            onLoadedMetadata={(event) => {
              const video = event.target;
              if (video.textTracks && video.textTracks.length > 0) {
                video.textTracks[0].mode = 'showing';
              }
            }}
          >
            <source src={mediaUrl(lecture.video_file_url)} type="video/mp4" />
            {subtitles.map((subtitle, index) => (
              <track
                key={subtitle.language}
                kind="captions"
                src={mediaUrl(subtitle.url)}
                srcLang={subtitle.language}
                label={subtitle.language_name}
                {...(index === 0 ? { default: true } : {})}
              />
            ))}
            Your browser does not support the video tag.
          </video>
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
          {lecture.duration > 0 && <span>Duration: {formatDuration(lecture.duration)}</span>}
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
