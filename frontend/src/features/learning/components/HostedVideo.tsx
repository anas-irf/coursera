import React, { useEffect, useRef } from 'react';

import { mediaUrl } from '../../../shared/lib/media';
import { resumePosition } from '../lib/player';
import type { PlayerVideoLecture, ReportWatch, WatchOptions } from '../types';

export const HEARTBEAT_MS = 15 * 1000;

interface HostedVideoProps {
  lecture: PlayerVideoLecture;
  /** Seconds to start from (unless that is the very beginning or nearly the end). */
  resumeAt?: number;
  onReport?: ReportWatch;
}

/** What the video's listeners need to know: one object, kept current on every render. */
interface HostedVideoState {
  playing: boolean;
  /** The last ``currentTime`` the video reported, in seconds. */
  position: number;
  /** When the server was last told (``Date.now()``), 0 before the first time. */
  lastSent: number;
  report: ReportWatch | undefined;
  resumeAt: number;
}

/**
 * An uploaded video file, with its subtitles.
 *
 * ``onReport(position, {finished})`` hears where the student is: every ``HEARTBEAT_MS`` while it
 * plays, when it is paused, when it ends and when the lecture is left.  It starts from
 * ``resumeAt`` (seconds) unless that is the very beginning or nearly the end.
 */
const HostedVideo = ({ lecture, resumeAt = 0, onReport }: HostedVideoProps) => {
  const subtitles = lecture.subtitles || [];
  // one object for what the listeners need to know, kept current on every render
  const state = useRef<HostedVideoState>({ playing: false, position: 0, lastSent: 0, report: onReport, resumeAt });

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

  const send = (position: number, options?: WatchOptions) => {
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
        const video = event.currentTarget;
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
        const { currentTime } = event.currentTarget;
        state.current.position = currentTime;
        if (state.current.playing && Date.now() - state.current.lastSent >= HEARTBEAT_MS) {
          send(currentTime);
        }
      }}
      onPause={(event) => {
        state.current.playing = false;
        if (!event.currentTarget.ended) send(event.currentTarget.currentTime);
      }}
      onEnded={(event) => {
        state.current.playing = false;
        send(event.currentTarget.duration || event.currentTarget.currentTime, { finished: true });
      }}
    >
      <source src={mediaUrl(lecture.video_file_url) ?? undefined} type="video/mp4" />
      {subtitles.map((subtitle, index) => (
        <track
          key={subtitle.language}
          kind="captions"
          src={mediaUrl(subtitle.url) ?? undefined}
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
