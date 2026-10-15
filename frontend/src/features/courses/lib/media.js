/**
 * The length in whole seconds of a video file the browser can read, or ``null`` when it cannot
 * (an unsupported container, a broken file, no object URLs).  Only the metadata is loaded.
 */
export function readVideoDuration(file) {
  return new Promise((resolve) => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      resolve(null);
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    const finish = (seconds) => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      if (typeof video.load === 'function') video.load();
      resolve(seconds);
    };

    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      finish(Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}
