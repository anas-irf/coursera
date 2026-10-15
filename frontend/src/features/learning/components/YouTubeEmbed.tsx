import React, { useEffect, useRef } from 'react';

import { useLatest } from '../../../shared/lib/useLatest';
import { resumePosition } from '../lib/player';
import { loadYouTubeApi } from '../lib/youtube';
import type { PlayerVideoLecture, ReportWatch, WatchOptions } from '../types';

const HEARTBEAT_MS = 15 * 1000;

interface YouTubeEmbedProps {
  lecture: PlayerVideoLecture;
  /** The video's id (``youTubeVideoId(lecture.video_url)``). */
  videoId: string;
  /** Seconds to start from (unless that is the very beginning or nearly the end). */
  resumeAt?: number;
  onReport?: ReportWatch;
}

/**
 * A YouTube video.  The page renders the iframe; YouTube's player API is attached to it so the
 * position can be reported like that of an uploaded file (``onReport(position, {finished})``).
 * When the API cannot be loaded the video still plays, it is just not tracked.
 */
const YouTubeEmbed = ({ lecture, videoId, resumeAt = 0, onReport }: YouTubeEmbedProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const report = useLatest(onReport);
  const resume = useLatest(resumeAt);

  useEffect(() => {
    let player: YT.Player | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let playing = false;
    let cancelled = false;

    const position = () => (player && typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : null);
    const send = (options?: WatchOptions) => {
      const at = position();
      if (at !== null && report.current) report.current(at, options);
    };

    loadYouTubeApi()
      .then((youtube) => {
        if (cancelled || !iframeRef.current) return;
        player = new youtube.Player(iframeRef.current, {
          events: {
            onReady: () => {
              // the player calls this once it is built, after the constructor has returned
              if (!player) return;
              const at = resumePosition(resume.current, player.getDuration && player.getDuration());
              if (at > 0) player.seekTo(at, true);
            },
            onStateChange: (event) => {
              if (timer !== null) clearInterval(timer);
              playing = event.data === youtube.PlayerState.PLAYING;
              if (playing) {
                timer = setInterval(() => send(), HEARTBEAT_MS);
              } else if (event.data === youtube.PlayerState.PAUSED) {
                send();
              } else if (event.data === youtube.PlayerState.ENDED) {
                send({ finished: true });
              }
            },
          },
        });
      })
      .catch(() => {
        // the embed plays without tracking
      });

    return () => {
      cancelled = true;
      if (timer !== null) clearInterval(timer);
      if (playing) send();
    };
  }, [lecture.id, videoId, report, resume]);

  const origin = typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : '';

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full"
      src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1${origin}`}
      title={lecture.title}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
};

export default YouTubeEmbed;
