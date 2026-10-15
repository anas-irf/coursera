// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// jsdom (Jest 27) has no TextEncoder, which react-router 7 needs at load time
if (typeof global.TextEncoder === 'undefined') {
  Object.assign(global, { TextEncoder, TextDecoder });
}
