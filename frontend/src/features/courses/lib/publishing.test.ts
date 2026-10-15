import { isLocked, publishAction } from './publishing';

test('a draft can be submitted, a rejected course resubmitted', () => {
  expect(publishAction('draft')).toMatchObject({ kind: 'submit', label: 'Request Publish', disabled: false });
  expect(publishAction('rejected')).toMatchObject({ kind: 'submit', label: 'Resubmit for Review', disabled: false });
});

test('a published course can be taken down and is locked meanwhile', () => {
  expect(publishAction('published')).toMatchObject({ kind: 'unpublish', label: 'Unpublish', disabled: false });
  expect(isLocked('published')).toBe(true);
  expect(isLocked('draft')).toBe(false);
});

test('a course under review waits', () => {
  expect(publishAction('pending_review')).toMatchObject({ kind: null, label: 'Under Review', disabled: true });
});

test('a state the workflow does not produce offers nothing instead of a button that does nothing', () => {
  expect(publishAction('unpublished')).toMatchObject({ kind: null, disabled: true });
  expect(publishAction(undefined)).toMatchObject({ kind: null, disabled: true });
});
