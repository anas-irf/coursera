import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchProfile } from '../../../shared/auth/api';
import { WS_URL } from '../../../shared/config';
import { session } from '../../../shared/lib/session';

const MAX_DELAY_MS = 30000;

export type SocketStatus = 'open' | 'closed';

export interface ReconnectingSocketOptions<TFrame> {
  /** e.g. "/ws/user/"; ``null`` stays disconnected. */
  path: string | null;
  /** Gets every frame, parsed from JSON.  The latest one is used: changing it does not reconnect. */
  onMessage: (frame: TFrame) => void;
}

export interface ReconnectingSocket<TOutgoing> {
  status: SocketStatus;
  /** Sends a frame as JSON; ``false`` when the socket is not open. */
  send: (payload: TOutgoing) => boolean;
}

/**
 * A WebSocket that lives as long as the component and reconnects with a growing delay.
 *
 * It carries no token: the browser sends the session cookie with the handshake.  After
 * repeated failures the session itself is checked (``/auth/profile/``, whose 401 makes the
 * client refresh or end the session) instead of retrying blindly with a session that expired.
 *
 * ``path`` is e.g. "/ws/user/"; pass ``null`` to stay disconnected.  Frames are parsed as JSON
 * and handed to the latest ``onMessage`` (changing it does not reconnect).  ``send`` returns
 * false when the socket is not open.
 *
 * ``TFrame`` is the frame the server sends on that path and ``TOutgoing`` the one the client
 * may send; the hook takes the server's word for what arrives (frames are not validated).
 */
export function useReconnectingSocket<TFrame, TOutgoing = unknown>({
  path,
  onMessage,
}: ReconnectingSocketOptions<TFrame>): ReconnectingSocket<TOutgoing> {
  const [status, setStatus] = useState<SocketStatus>('closed');
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  });

  useEffect(() => {
    if (!path) return undefined;

    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (stopped || !session.isAuthenticated()) return;

      const socket = new WebSocket(`${WS_URL}${path}`);
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setStatus('open');
      };

      socket.onmessage = (event) => {
        try {
          // ``event.data`` is text; what it holds is the frame the caller declared
          const frame: TFrame = JSON.parse(event.data);
          handlerRef.current(frame);
        } catch (error) {
          // not a frame we understand
        }
      };

      socket.onerror = () => socket.close();

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (stopped) return;
        setStatus('closed');

        const delay = Math.min(MAX_DELAY_MS, 1000 * 2 ** attempt);
        attempt += 1;
        timer = setTimeout(async () => {
          if (attempt > 2) {
            // repeated failures are most often an expired session: ask the server about it
            try {
              await fetchProfile();
            } catch (error) {
              // the client has ended the session; the unmount stops us
            }
          }
          connect();
        }, delay);
      };
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      if (socketRef.current) socketRef.current.close(1000);
      socketRef.current = null;
      setStatus('closed');
    };
  }, [path]);

  const send = useCallback((payload: TOutgoing): boolean => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  return { status, send };
}
