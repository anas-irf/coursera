const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  /youtube\.com\/v\/([^&\n?#]+)/,
];

/** The video id of a YouTube watch, share or embed URL; ``null`` for anything else. */
export const youTubeVideoId = (url) => {
  if (!url) return null;
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const API_URL = 'https://www.youtube.com/iframe_api';
let apiPromise = null;

/**
 * Loads YouTube's IFrame Player API once and resolves with ``window.YT``.
 *
 * It is what lets the page know where the student is in an embedded video.  If the script cannot
 * be loaded (offline, blocked) the promise rejects and the embed simply plays without tracking.
 */
export function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);

  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === 'function') previous();
        resolve(window.YT);
      };

      const script = document.createElement('script');
      script.src = API_URL;
      script.async = true;
      script.onerror = () => {
        apiPromise = null; // a later lecture may try again
        reject(new Error('The YouTube player API could not be loaded'));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

/** Test hook: forget a loaded or pending API so the next call loads it again. */
export function resetYouTubeApiForTests() {
  apiPromise = null;
}
