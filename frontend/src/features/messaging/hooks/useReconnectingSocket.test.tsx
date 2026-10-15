import React from 'react';
import { act, render } from '@testing-library/react';

import { fetchProfile } from '../../../shared/auth/api';
import type { User } from '../../../shared/auth/types';
import { session } from '../../../shared/lib/session';
import type { OutgoingFrame, UserFrame } from '../types';
import { useReconnectingSocket } from './useReconnectingSocket';
import type { ReconnectingSocket } from './useReconnectingSocket';

jest.mock('../../../shared/auth/api', () => ({ fetchProfile: jest.fn() }));

const mockedFetchProfile = jest.mocked(fetchProfile);

const user = { id: 1 } as User;

class FakeSocket {
  static instances: FakeSocket[] = [];

  static OPEN = 1;

  url: string;

  readyState: number;

  sent: string[];

  closedWith?: number;

  // set by the hook under test, as it would on a real socket
  onopen: (() => void) | null = null;

  onmessage: ((event: { data: string }) => void) | null = null;

  onclose: ((event: { code?: number }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number) {
    this.closedWith = code;
    this.readyState = 3;
    if (this.onclose) this.onclose({ code });
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

let api: ReconnectingSocket<OutgoingFrame>;
const frames: UserFrame[] = [];

function Probe({ path }: { path: string | null }) {
  api = useReconnectingSocket<UserFrame, OutgoingFrame>({ path, onMessage: (frame) => frames.push(frame) });
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  FakeSocket.instances = [];
  frames.length = 0;
  global.WebSocket = FakeSocket as unknown as typeof WebSocket;
  window.localStorage.clear();
  mockedFetchProfile.mockReset();
  mockedFetchProfile.mockResolvedValue({ user, profile: null });
  session.reset();
  session.start({ user });
});

afterEach(() => {
  jest.useRealTimers();
});

test('connects without a token (the cookie goes with the handshake) and hands frames to the handler', () => {
  render(<Probe path="/ws/user/" />);

  expect(FakeSocket.instances).toHaveLength(1);
  expect(FakeSocket.instances[0].url).toBe('ws://localhost:8000/ws/user/');

  act(() => FakeSocket.instances[0].open());
  expect(api.status).toBe('open');

  act(() => FakeSocket.instances[0].receive({ type: 'chat_message', message: { id: 1 } }));
  expect(frames).toEqual([{ type: 'chat_message', message: { id: 1 } }]);
});

test('send only works while the socket is open', () => {
  render(<Probe path="/ws/chat/conv_1_2/" />);

  expect(api.send({ type: 'typing', is_typing: false })).toBe(false);
  act(() => FakeSocket.instances[0].open());
  expect(api.send({ type: 'typing', is_typing: true })).toBe(true);
  expect(FakeSocket.instances[0].sent).toEqual([JSON.stringify({ type: 'typing', is_typing: true })]);
});

test('reconnects with a growing delay', () => {
  render(<Probe path="/ws/user/" />);

  act(() => FakeSocket.instances[0].close(1006));
  expect(FakeSocket.instances).toHaveLength(1);

  act(() => jest.advanceTimersByTime(1000));
  expect(FakeSocket.instances).toHaveLength(2);

  act(() => FakeSocket.instances[1].close(1006));
  act(() => jest.advanceTimersByTime(1500));
  expect(FakeSocket.instances).toHaveLength(2); // waits 2 s this time
  act(() => jest.advanceTimersByTime(500));
  expect(FakeSocket.instances).toHaveLength(3);
});

test('closes when the component goes away and does not reconnect', () => {
  const { unmount } = render(<Probe path="/ws/user/" />);
  const socket = FakeSocket.instances[0];

  unmount();
  act(() => jest.advanceTimersByTime(60000));

  expect(socket.closedWith).toBe(1000);
  expect(FakeSocket.instances).toHaveLength(1);
});

test('stays disconnected without a path', () => {
  render(<Probe path={null} />);

  expect(FakeSocket.instances).toHaveLength(0);
});

test('stays disconnected while nobody is signed in', () => {
  session.setAnonymous();

  render(<Probe path="/ws/user/" />);

  expect(FakeSocket.instances).toHaveLength(0);
});

test('after repeated failures the session is checked before the next attempt', async () => {
  render(<Probe path="/ws/user/" />);

  // two quick failures reconnect at once ...
  act(() => FakeSocket.instances[0].close(1006));
  await act(async () => jest.advanceTimersByTime(1000));
  act(() => FakeSocket.instances[1].close(1006));
  await act(async () => jest.advanceTimersByTime(2000));
  expect(mockedFetchProfile).not.toHaveBeenCalled();
  expect(FakeSocket.instances).toHaveLength(3);

  // ... the third one asks the server whether the session is still good
  act(() => FakeSocket.instances[2].close(1006));
  await act(async () => jest.advanceTimersByTime(4000));
  expect(mockedFetchProfile).toHaveBeenCalledTimes(1);
  expect(FakeSocket.instances).toHaveLength(4);
});

test('a session that ended while the socket was down is not reconnected', async () => {
  render(<Probe path="/ws/user/" />);

  act(() => FakeSocket.instances[0].close(1006));
  session.setAnonymous();
  await act(async () => jest.advanceTimersByTime(1000));

  expect(FakeSocket.instances).toHaveLength(1);
});
