import React, { useEffect, useRef } from 'react';

import { mediaUrl } from '../../../shared/lib/media';
import { resumePosition } from '../lib/player';

export const HEARTBEAT_MS = 15 * 1000;

/**
 * An uploaded video file, with its subtitles.
 *
 * ``onReport(position, {finished})`` hears where the student is: every ``HEARTBEAT_MS`` while it
 * plays, when it is paused, when it ends and when the lecture is left.  It starts from
 * ``resumeAt`` (seconds) unless that is the very beginning or nearly the end.
 */
const HostedVideo = ({ lecture, resumeAt = 0, onReport }) => {
  const subtitles = lecture.subtitles || [];
  // one object for what the listeners need to know, kept current on every render
  const state = useRef({ playing: false, position: 0, lastSent: 0, report: onReport, resumeAt });

  useEffect(() => {
    state.current.report = onReport;
    state.current.resumeAt = resumeAt;
  });

  // leaving the lecture while it plays still tells the server where the student got to
  useEffect(() => {
    const current = state.current;
    return () => {
      if (current.playing && current.report) current.report(current.position);
    };
  }, []);

  const send = (position, options) => {
    state.current.lastSent = Date.now();
    if (state.current.report) state.current.report(position, options);
  };

  return (
    <video
      controls
      aria-label={lecture.title}
      crossOrigin="anonymous"
      className="w-full h-full"
      poster={mediaUrl(lecture.thumbnail) || undefined}
      preload="metadata"
      onLoadedMetadata={(event) => {
        const video = event.target;
        if (video.textTracks && video.textTracks.length > 0) {
          video.textTracks[0].mode = 'showing';
        }
        const at = resumePosition(state.current.resumeAt, video.duration);
        if (at > 0) video.currentTime = at;
      }}
      onPlay={() => {
        state.current.playing = true;
        state.current.lastSent = Date.now();
      }}
      onTimeUpdate={(event) => {
        const { currentTime } = event.target;
        state.current.position = currentTime;
        if (state.current.playing && Date.now() - state.current.lastSent >= HEARTBEAT_MS) {
          send(currentTime);
        }
      }}
      onPause={(event) => {
        state.current.playing = false;
        if (!event.target.ended) send(event.target.currentTime);
      }}
      onEnded={(event) => {
        state.current.playing = false;
        send(event.target.duration || event.target.currentTime, { finished: true });
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
  );
};

export default HostedVideo;
