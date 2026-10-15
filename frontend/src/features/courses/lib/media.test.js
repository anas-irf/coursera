import { readVideoDuration } from './media';

const file = new File(['x'], 'lecture.mp4', { type: 'video/mp4' });

let fake;

beforeEach(() => {
  fake = { removeAttribute: jest.fn(), load: jest.fn() };
  jest.spyOn(document, 'createElement').mockReturnValue(fake);
  URL.createObjectURL = jest.fn(() => 'blob:lecture');
  URL.revokeObjectURL = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete URL.createObjectURL;
  delete URL.revokeObjectURL;
});

test('reads the length from the metadata and lets the file go', async () => {
  const pending = readVideoDuration(file);
  fake.duration = 125.4;
  fake.onloadedmetadata();

  expect(await pending).toBe(125);
  expect(fake.preload).toBe('metadata');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:lecture');
});

test('a file the browser cannot read has no length', async () => {
  const pending = readVideoDuration(file);
  fake.onerror();

  expect(await pending).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});

test('a stream of unknown length has none either', async () => {
  const pending = readVideoDuration(file);
  fake.duration = Infinity;
  fake.onloadedmetadata();

  expect(await pending).toBeNull();
});

test('without object URLs there is nothing to read', async () => {
  delete URL.createObjectURL;

  expect(await readVideoDuration(file)).toBeNull();
});
