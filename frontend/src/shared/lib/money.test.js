import { formatMoney } from './money';

test('amounts are shown with cents and thousands separators', () => {
  expect(formatMoney(435.4)).toBe('$435.40');
  expect(formatMoney(1250)).toBe('$1,250.00');
  expect(formatMoney('99.5')).toBe('$99.50');
  expect(formatMoney(0.005)).toBe('$0.01');
});

test('a missing amount is zero, not NaN', () => {
  expect(formatMoney(null)).toBe('$0.00');
  expect(formatMoney(undefined)).toBe('$0.00');
  expect(formatMoney('')).toBe('$0.00');
});
