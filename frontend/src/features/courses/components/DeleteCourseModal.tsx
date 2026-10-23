import React, { useId, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import type { User } from '../../../shared/auth/types';
import { Button, IconButton } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Field } from '../../../shared/ui/Field';
import { Input } from '../../../shared/ui/Input';
import Modal from '../../../shared/ui/Modal';
import type { InstructorCourseRow } from '../types';

interface DeleteCourseModalProps {
  /** The course to delete: its title is what the user retypes. */
  course: Pick<InstructorCourseRow, 'title'>;
  /** Who is signed in: their e-mail is the first half of what the user retypes. */
  currentUser: Pick<User, 'email'> | null;
  onClose: () => void;
  /** Deletes the course with the typed confirmation; a rejection is shown in the dialog. */
  onConfirm: (confirmation: string) => Promise<void>;
}

const CONSEQUENCES = [
  'The course, its sections and its lectures are deleted',
  'Uploaded videos, readings and attachments go with them',
  'Its analytics and learner progress are removed',
  'Nothing of it can be recovered afterwards',
];

const DeleteCourseModal = ({ course, currentUser, onClose, onConfirm }: DeleteCourseModalProps) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();

  const expectedConfirmation = `${currentUser?.email}/${course?.title}`;

  const handleDelete = async () => {
    if (confirmationInput !== expectedConfirmation) {
      setError(`Please type "${expectedConfirmation}" to confirm.`);
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      await onConfirm(confirmationInput);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete course'));
      setIsDeleting(false);
    }
  };

  const isConfirmationValid = confirmationInput === expectedConfirmation;

  return (
    <Modal bare size="sm" labelledBy={titleId} onClose={isDeleting ? undefined : onClose}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-fg">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-fg">Delete Course</h2>
            <p className="mt-0.5 text-sm text-fg-muted">This action cannot be undone.</p>
          </div>
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} disabled={isDeleting} className="-mr-2 -mt-1" />
        </div>

        <Callout tone="danger" icon={null} className="mt-5" title="This permanently deletes the course:">
          <span className="mt-1 block break-words font-mono text-xs text-danger-fg">{course?.title}</span>
        </Callout>

        <ul className="mt-4 space-y-1.5 text-sm text-fg-muted">
          {CONSEQUENCES.map((consequence) => (
            <li key={consequence} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-danger-fg" aria-hidden="true" />
              {consequence}
            </li>
          ))}
        </ul>

        <Field
          className="mt-5"
          label={
            <span className="font-normal text-fg-muted">
              Type <span className="break-all font-mono font-medium text-danger-fg">{expectedConfirmation}</span> to confirm
            </span>
          }
          error={error || undefined}
        >
          <Input
            data-autofocus
            value={confirmationInput}
            onChange={(event) => {
              setConfirmationInput(event.target.value);
              setError('');
            }}
            disabled={isDeleting}
            placeholder={expectedConfirmation}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={handleDelete}
            disabled={!isConfirmationValid}
            loading={isDeleting}
          >
            Delete Course
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteCourseModal;
