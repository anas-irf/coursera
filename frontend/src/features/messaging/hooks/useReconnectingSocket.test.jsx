import React from 'react';
import { act, render } from '@testing-library/react';

import { session } from '../../../shared/lib/session';
import { useReconnectingSocket } from './useReconnectingSocket';

class FakeSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close(code) {
    this.closedWith = code;
    this.readyState = 3;
    if (this.onclose) this.onclose({ code });
  }

  open() {
    this.readyState = 1;
    this.onopen();
  }

  receive(frame) {
    this.onmessage({ data: JSON.stringify(frame) });
  }
}
FakeSocket.OPEN = 1;

let api;
const frames = [];

function Probe({ path }) {
  api = useReconnectingSocket({ path, onMessage: (frame) => frames.push(frame) });
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  FakeSocket.instances = [];
  frames.length = 0;
  global.WebSocket = FakeSocket;
  window.localStorage.clear();
  session.start({ tokens: { access: 'token-1', refresh: 'refresh-1' }, user: { id: 1 } });
});

afterEach(() => {
  jest.useRealTimers();
});

test('connects with the access token and hands frames to the handler', () => {
  render(<Probe path="/ws/user/" />);

  expect(FakeSocket.instances).toHaveLength(1);
  expect(FakeSocket.instances[0].url).toBe('ws://localhost:8000/ws/user/?token=token-1');

  act(() => FakeSocket.instances[0].open());
  expect(api.status).toBe('open');

  act(() => FakeSocket.instances[0].receive({ type: 'chat_message', message: { id: 1 } }));
  expect(frames).toEqual([{ type: 'chat_message', message: { id: 1 } }]);
});

test('send only works while the socket is open', () => {
  render(<Probe path="/ws/chat/conv_1_2/" />);

  expect(api.send({ type: 'typing' })).toBe(false);
  act(() => FakeSocket.instances[0].open());
  expect(api.send({ type: 'typing', is_typing: true })).toBe(true);
  expect(FakeSocket.instances[0].sent).toEqual([JSON.stringify({ type: 'typing', is_typing: true })]);
});

test('reconnects with a growing delay and the latest token', () => {
  render(<Probe path="/ws/user/" />);

  act(() => FakeSocket.instances[0].close(1006));
  expect(FakeSocket.instances).toHaveLength(1);

  session.setTokens({ access: 'token-2' });
  act(() => jest.advanceTimersByTime(1000));
  expect(FakeSocket.instances).toHaveLength(2);
  expect(FakeSocket.instances[1].url).toContain('token=token-2');

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
