// The part of YouTube's IFrame Player API that features/learning uses.
// https://developers.google.com/youtube/iframe_api_reference
//
// The script (https://www.youtube.com/iframe_api) puts ``YT`` on ``window`` and then calls
// ``window.onYouTubeIframeAPIReady``; ``loadYouTubeApi()`` in features/learning/lib/youtube.ts
// is what loads it.  Only what the two players read is declared here: when the code needs
// another method or state, it is added to this file.
//
// The namespace holds types only, so that no global value ``YT`` exists for the compiler:
// ``window.YT`` is what the script sets, and it is optional because the script may not have
// loaded (the code reaches it through ``loadYouTubeApi()``).
//
// This file has no import and no export on purpose: that is what makes these declarations global.

declare namespace YT {
  /** What a listener of ``onReady`` is given. */
  interface PlayerEvent {
    target: Player;
  }

  /** What ``onStateChange`` is given: ``data`` is one of ``PlayerState``. */
  interface OnStateChangeEvent {
    target: Player;
    data: number;
  }

  interface PlayerOptions {
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
    };
  }

  /**
   * A player attached to an ``<iframe>`` that was loaded with ``enablejsapi=1``.  The methods
   * exist only once ``onReady`` has been called.
   */
  interface Player {
    /** Seconds from the start of the video. */
    getCurrentTime(): number;

    /** Seconds; ``0`` until the metadata has loaded. */
    getDuration(): number;

    seekTo(seconds: number, allowSeekAhead: boolean): void;
  }

  /** The states ``onStateChange`` reports that the players tell apart (the API has more). */
  interface PlayerStates {
    readonly ENDED: 0;
    readonly PLAYING: 1;
    readonly PAUSED: 2;
  }

  /** What ``window.YT`` is once YouTube's script has loaded. */
  interface IFrameApi {
    Player: new (element: HTMLElement | string, options?: PlayerOptions) => Player;
    PlayerState: PlayerStates;
  }
}

interface Window {
  /** Set by YouTube's script once it has loaded. */
  YT?: YT.IFrameApi;
  /** Called by YouTube's script when ``YT`` is ready. */
  onYouTubeIframeAPIReady?: () => void;
}
