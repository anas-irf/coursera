import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { Modal } from './Modal';

const Opener = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Modal title="Edit course" onClose={() => setOpen(false)}>
          <input aria-label="Title" />
          <button>Save</button>
        </Modal>
      )}
    </>
  );
};

test('is a named dialog with a heading and a close button', () => {
  render(<Modal title="Edit course" onClose={() => {}}><p>body</p></Modal>);

  const dialog = screen.getByRole('dialog', { name: 'Edit course' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByRole('heading', { name: 'Edit course' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
});

test('Escape and the close button ask to close', () => {
  const onClose = jest.fn();
  render(<Modal title="Edit course" onClose={onClose}><p>body</p></Modal>);

  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));

  expect(onClose).toHaveBeenCalledTimes(2);
});

test('focus moves into the dialog and returns to the opener when it closes', () => {
  render(<Opener />);
  const opener = screen.getByRole('button', { name: 'Open' });
  opener.focus();

  fireEvent.click(opener);
  expect(screen.getByRole('dialog')).toHaveFocus();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

test('Tab wraps around inside the dialog', () => {
  render(<Modal title="Edit course" onClose={() => {}}><input aria-label="Title" /><button>Save</button></Modal>);
  const save = screen.getByRole('button', { name: 'Save' });
  save.focus();

  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(save).toHaveFocus();
});

test('only the newest dialog answers Escape', () => {
  const outer = jest.fn();
  const inner = jest.fn();
  render(
    <>
      <Modal title="Outer" onClose={outer}><p>outer</p></Modal>
      <Modal title="Inner" onClose={inner} layer="top"><p>inner</p></Modal>
    </>
  );

  fireEvent.keyDown(document, { key: 'Escape' });

  expect(inner).toHaveBeenCalledTimes(1);
  expect(outer).not.toHaveBeenCalled();
});

test('the page behind does not scroll while a dialog is open', () => {
  const { unmount } = render(<Modal title="Edit course" onClose={() => {}}><p>body</p></Modal>);
  expect(document.body.style.overflow).toBe('hidden');

  unmount();
  expect(document.body.style.overflow).not.toBe('hidden');
});

test('a bare dialog is named by the element its content points at', () => {
  render(
    <Modal bare labelledBy="my-title" onClose={() => {}}>
      <h3 id="my-title">Delete this?</h3>
    </Modal>
  );

  expect(screen.getByRole('dialog', { name: 'Delete this?' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
});
