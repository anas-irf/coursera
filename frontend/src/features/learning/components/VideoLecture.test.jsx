import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { createQueryClient } from '../../../shared/query/client';
import { QueryProvider } from '../../../shared/query/QueryProvider';
import * as api from '../api';
import { learningKeys } from '../hooks/useLearning';
import { resetYouTubeApiForTests } from '../lib/youtube';
import VideoLecture from './VideoLecture';

jest.mock('../api');

const hosted = {
  id: 'l-1',
  title: 'Values and types',
  content_type: 'video',
  video_type: 'upload',
  video_file_url: '/media/videos/a.mp4',
  video_url: null,
  duration: 600,
  last_watched_position: 120,
  watch_count: 0,
};

const youtube = {
  ...hosted,
  id: 'l-2',
  video_type: 'youtube',
  video_file_url: null,
  video_url: 'https://www.youtube.com/watch?v=abc123',
  last_watched_position: 90,
};

let client;

const renderVideo = (lecture) => {
  client = createQueryClient();
  client.setQueryData(learningKeys.player('c-1'), {
    sections: [{ id: 's', lectures: [{ ...lecture }] }],
  });
  return render(
    <QueryProvider client={client}>
      <VideoLecture courseId="c-1" lecture={lecture} />
    </QueryProvider>
  );
};

const video = () => screen.getByLabelText('Values and types');
const setTime = (element, seconds) =>
  Object.defineProperty(element, 'currentTime', { value: seconds, writable: true, configurable: true });

beforeEach(() => {
  jest.clearAllMocks();
  api.recordWatchProgress.mockResolvedValue({
    last_watched_position: 42, progress_seconds: 42, watch_count: 0, total_time_spent: 42,
  });
});

describe('an uploaded video', () => {
  test('resumes where the student stopped', () => {
    renderVideo(hosted);
    const element = video();
    Object.defineProperty(element, 'duration', { value: 600, configurable: true });

    fireEvent.loadedMetadata(element);

    expect(element.currentTime).toBe(120);
  });

  test('starts over when the stored place is the very end', () => {
    renderVideo({ ...hosted, last_watched_position: 598 });
    const element = video();
    Object.defineProperty(element, 'duration', { value: 600, configurable: true });

    fireEvent.loadedMetadata(element);

    expect(element.currentTime).toBe(0);
  });

  test('a pause reports the position and the answer reaches the cached outline', async () => {
    renderVideo(hosted);
    const element = video();

    fireEvent.play(element);
    setTime(element, 42.7);
    fireEvent.pause(element);

    expect(api.recordWatchProgress).toHaveBeenCalledWith('c-1', 'l-1', { position: 42, finished: false });
    await waitFor(() => {
      const cached = client.getQueryData(learningKeys.player('c-1'));
      expect(cached.sections[0].lectures[0].last_watched_position).toBe(42);
    });
  });

  test('playing is reported at most once every fifteen seconds', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000_000);
    renderVideo(hosted);
    const element = video();

    fireEvent.play(element);
    nowSpy.mockReturnValue(1_000_000 + 5_000);
    setTime(element, 5);
    fireEvent.timeUpdate(element);
    expect(api.recordWatchProgress).not.toHaveBeenCalled();

    nowSpy.mockReturnValue(1_000_000 + 16_000);
    setTime(element, 16);
    fireEvent.timeUpdate(element);
    expect(api.recordWatchProgress).toHaveBeenCalledTimes(1);
    expect(api.recordWatchProgress).toHaveBeenCalledWith('c-1', 'l-1', { position: 16, finished: false });

    nowSpy.mockReturnValue(1_000_000 + 20_000);
    setTime(element, 20);
    fireEvent.timeUpdate(element);
    expect(api.recordWatchProgress).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });

  test('reaching the end is reported as finished', () => {
    renderVideo(hosted);
    const element = video();
    Object.defineProperty(element, 'duration', { value: 600, configurable: true });

    fireEvent.play(element);
    fireEvent.ended(element);

    expect(api.recordWatchProgress).toHaveBeenCalledWith('c-1', 'l-1', { position: 600, finished: true });
  });

  test('leaving the lecture while it plays reports where the student got to', () => {
    const { unmount } = renderVideo(hosted);
    const element = video();

    fireEvent.play(element);
    setTime(element, 77);
    fireEvent.timeUpdate(element);
    unmount();

    expect(api.recordWatchProgress).toHaveBeenCalledWith('c-1', 'l-1', { position: 77, finished: false });
  });

  test('a failed report does not disturb the lecture', async () => {
    api.recordWatchProgress.mockRejectedValue({ response: { status: 500 } });
    renderVideo(hosted);
    const element = video();

    fireEvent.play(element);
    setTime(element, 30);
    fireEvent.pause(element);
    await waitFor(() => expect(api.recordWatchProgress).toHaveBeenCalled());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(video()).toBeInTheDocument();
  });
});

describe('a YouTube video', () => {
  let player;
  let events;

  beforeEach(() => {
    events = undefined;
    resetYouTubeApiForTests();
    player = { getCurrentTime: jest.fn(() => 33), getDuration: jest.fn(() => 600), seekTo: jest.fn() };
    window.YT = {
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
      Player: function FakePlayer(element, options) {
        events = options.events;
        return player;
      },
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete window.YT;
  });

  const mount = async (lecture = youtube) => {
    renderVideo(lecture);
    await waitFor(() => expect(events).toBeDefined()); // the API promise settled
  };

  test('is embedded with the player API enabled', async () => {
    await mount();

    expect(screen.getByTitle('Values and types').getAttribute('src')).toMatch(
      /^https:\/\/www\.youtube\.com\/embed\/abc123\?enablejsapi=1/
    );
  });

  test('resumes where the student stopped', async () => {
    await mount();

    events.onReady();

    expect(player.seekTo).toHaveBeenCalledWith(90, true);
  });

  test('reports while playing, on pause and at the end', async () => {
    await mount();

    events.onStateChange({ data: 1 });
    await act(async () => {
      jest.advanceTimersByTime(15 * 1000);
    });
    expect(api.recordWatchProgress).toHaveBeenCalledWith('c-1', 'l-2', { position: 33, finished: false });

    api.recordWatchProgress.mockClear();
    events.onStateChange({ data: 2 });
    expect(api.recordWatchProgress).toHaveBeenCalledTimes(1);

    api.recordWatchProgress.mockClear();
    events.onStateChange({ data: 0 });
    expect(api.recordWatchProgress).toHaveBeenCalledWith('c-1', 'l-2', { position: 33, finished: true });
  });

  test('no heartbeat is sent while it is not playing', async () => {
    await mount();

    events.onStateChange({ data: 2 });
    api.recordWatchProgress.mockClear();
    await act(async () => {
      jest.advanceTimersByTime(60 * 1000);
    });

    expect(api.recordWatchProgress).not.toHaveBeenCalled();
  });
});

test('a lecture without any video says so', () => {
  renderVideo({ ...hosted, video_file_url: null });

  expect(screen.getByText('Video content not available')).toBeInTheDocument();
});
