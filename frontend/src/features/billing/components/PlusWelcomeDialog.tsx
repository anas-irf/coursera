import React, { useId } from 'react';
import { Award, BookOpen, Crown, Infinity as InfinityIcon } from 'lucide-react';

import { BRAND } from '../../../shared/brand';
import { Button } from '../../../shared/ui/Button';
import Modal from '../../../shared/ui/Modal';

interface PlusWelcomeDialogProps {
  onClose: () => void;
}

const PERKS = [
  { icon: InfinityIcon, text: 'Every Plus course is open to you' },
  { icon: Award, text: 'Earn a certificate for each course you pass' },
  { icon: BookOpen, text: 'Your progress carries over, nothing to set up' },
];

/** Congratulations popup shown after a successful Stripe checkout. */
const PlusWelcomeDialog = ({ onClose }: PlusWelcomeDialogProps) => {
  const titleId = useId();

  return (
    <Modal bare size="sm" labelledBy={titleId} onClose={onClose}>
      <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-plus via-brand-700 to-brand-900 px-6 pb-8 pt-10 text-center text-white sm:rounded-t-2xl">
        <div className="bg-dots absolute inset-0 opacity-40" aria-hidden="true" />
        <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
          <Crown size={32} aria-hidden="true" />
        </span>
        <h2 id={titleId} className="relative mt-5 text-2xl font-semibold tracking-tight">
          Welcome to {BRAND.plus}
        </h2>
        <p className="relative mt-1 text-sm text-brand-100">Your subscription is now active.</p>
      </div>
      <div className="space-y-5 p-6">
        <ul className="space-y-3">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-fg-muted">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-plus-soft text-plus-fg">
                <Icon size={16} aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>
        <Button block size="lg" onClick={onClose} data-autofocus>
          Start learning
        </Button>
      </div>
    </Modal>
  );
};

export default PlusWelcomeDialog;
