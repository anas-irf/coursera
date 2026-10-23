import { pageSocketOrigin } from './config';

test('the WebSocket origin of a page follows its protocol and host', () => {
  expect(pageSocketOrigin({ protocol: 'https:', host: 'learn.example.com' })).toBe('wss://learn.example.com');
  expect(pageSocketOrigin({ protocol: 'http:', host: 'localhost:3000' })).toBe('ws://localhost:3000');
});
