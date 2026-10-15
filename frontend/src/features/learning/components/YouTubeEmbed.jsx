import React, { useEffect, useRef } from 'react';

import { useLatest } from '../../../shared/lib/useLatest';
import { resumePosition } from '../lib/player';
import { loadYouTubeApi } from '../lib/youtube';

const HEARTBEAT_MS = 15 * 1000;

/**
 * A YouTube video.  The page renders the iframe; YouTube's player API is attached to it so the
 * position can be reported like that of an uploaded file (``onReport(position, {finished})``).
 * When the API cannot be loaded the video still plays, it is just not tracked.
 */
const YouTubeEmbed = ({ lecture, videoId, resumeAt = 0, onReport }) => {
  const iframeRef = useRef(null);
  const report = useLatest(onReport);
  const resume = useLatest(resumeAt);

  useEffect(() => {
    let player = null;
    let timer = null;
    let playing = false;
    let cancelled = false;

    const position = () => (player && typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : null);
    const send = (options) => {
      const at = position();
      if (at !== null && report.current) report.current(at, options);
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !iframeRef.current) return;
        player = new YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              const at = resumePosition(resume.current, player.getDuration && player.getDuration());
              if (at > 0) player.seekTo(at, true);
            },
            onStateChange: (event) => {
              clearInterval(timer);
              playing = event.data === YT.PlayerState.PLAYING;
              if (playing) {
                timer = setInterval(() => send(), HEARTBEAT_MS);
              } else if (event.data === YT.PlayerState.PAUSED) {
                send();
              } else if (event.data === YT.PlayerState.ENDED) {
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
      clearInterval(timer);
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
