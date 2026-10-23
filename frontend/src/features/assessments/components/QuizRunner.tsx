import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, FileQuestion, PlayCircle, RotateCcw, Send, Trophy, XCircle } from 'lucide-react';

import { errorCode, errorMessage } from '../../../shared/api/errors';
import { cn } from '../../../shared/lib/cn';
import { formatClock } from '../../../shared/lib/time';
import { useCountdown } from '../../../shared/lib/useCountdown';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Card } from '../../../shared/ui/Card';
import { inputClasses } from '../../../shared/ui/Input';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { Metric } from '../../../shared/ui/StatCard';
import { useToast } from '../../../shared/ui/Toast';
import { useStartQuiz, useSubmitQuiz } from '../hooks/useAttempts';
import type { QuizAnswer, QuizAnswers, QuizAttempt, QuizLecture, QuizResults } from '../types';

const TIME_LIMIT_EXCEEDED = 'time_limit_exceeded';
const WARNING_SECONDS = 60;

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Single choice',
  true_false: 'True or false',
  multiple_select: 'Multiple choice',
  fill_blank: 'Fill in the blank',
  essay: 'Essay',
};

// an option row: the whole row is the label of its radio button or checkbox
const OPTION =
  'flex cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm text-fg transition-colors ' +
  'hover:border-line-strong hover:bg-surface-muted/60 has-[:checked]:border-primary has-[:checked]:bg-primary-soft/60 ' +
  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring';

interface QuizRunnerProps {
  /** The quiz block of a player lecture (a lecture with more fields is fine). */
  lecture: QuizLecture;
  /** Called after a submission (also one the server refused as too late); awaited. */
  onFinished?: () => unknown;
  /** Called with ``true`` while an attempt is open and with ``false`` when it is not. */
  onActiveChange?: (active: boolean) => void;
}

const answered = (answer: QuizAnswer | undefined): boolean => {
  if (!answer) return false;
  if ('selected_option' in answer) return Boolean(answer.selected_option);
  if ('selected_options' in answer) return answer.selected_options.length > 0;
  return answer.text_answer.trim().length > 0;
};

/**
 * A quiz lecture: overview -> taking -> results.
 *
 * ``onActiveChange(true)`` is called while an attempt is open so the player can
 * ask before the student leaves the quiz; ``onFinished`` after a submission so
 * the player reloads progress.
 *
 * A quiz with a time limit counts down to the ``expires_at`` the server sent and hands the
 * answers in by itself when the time is up; the server refuses answers that come in later
 * (``time_limit_exceeded``), which is then said plainly.
 */
const QuizRunner = ({ lecture, onFinished, onActiveChange }: QuizRunnerProps) => {
  const toast = useToast();
  const startQuiz = useStartQuiz();
  const submitQuiz = useSubmitQuiz();
  const [mode, setMode] = useState<'taking' | 'results' | null>(null); // null | 'taking' | 'results'
  const [quiz, setQuiz] = useState<QuizAttempt | null>(null);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [results, setResults] = useState<QuizResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const answersRef = useRef<QuizAnswers>({});
  const autoSubmitted = useRef(false);
  const remaining = useCountdown(mode === 'taking' && quiz ? quiz.expires_at : null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (onActiveChange) onActiveChange(mode === 'taking');
    return () => {
      if (onActiveChange) onActiveChange(false);
    };
  }, [mode, onActiveChange]);

  const start = async () => {
    setBusy(true);
    try {
      setQuiz(await startQuiz.mutateAsync(lecture.quiz_id));
      setAnswers({});
      setResults(null);
      setTimeUp(false);
      autoSubmitted.current = false;
      setMode('taking');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to start quiz. Please try again.'), 'Quiz Error');
    } finally {
      setBusy(false);
    }
  };

  const exit = useCallback(() => {
    setMode(null);
    setQuiz(null);
    setAnswers({});
    setResults(null);
  }, []);

  const submit = useCallback(async () => {
    if (!quiz) return;
    setBusy(true);
    try {
      const data = await submitQuiz.mutateAsync({
        quizId: quiz.quiz.id,
        attemptId: quiz.attempt_id,
        answers: answersRef.current,
      });
      setResults(data.results);
      setMode('results');
      if (onFinished) await onFinished();
    } catch (err) {
      if (errorCode(err) === TIME_LIMIT_EXCEEDED) {
        // the attempt was closed by the server; the overview shows it as used
        setTimeUp(true);
        exit();
        if (onFinished) await onFinished();
      } else {
        toast.error(errorMessage(err, 'Failed to submit quiz. Please try again.'), 'Quiz Submission Failed');
      }
    } finally {
      setBusy(false);
    }
  }, [quiz, onFinished, exit, toast, submitQuiz]);

  // time is up: the answers given so far are handed in
  useEffect(() => {
    if (mode === 'taking' && remaining === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  }, [mode, remaining, submit]);

  const answer = (questionId: string, value: QuizAnswer) =>
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

  if (mode === 'taking' && quiz) {
    const done = quiz.questions.filter((question) => answered(answers[question.id])).length;
    const urgent = remaining !== null && remaining <= WARNING_SECONDS;
    return (
      <div className="space-y-5">
        <Card className="sticky top-0 z-10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-semibold text-fg">{quiz.quiz.title}</h3>
              {quiz.quiz.description && <p className="mt-0.5 text-sm text-fg-muted">{quiz.quiz.description}</p>}
              <p className="mt-1 text-xs text-fg-subtle">
                Passing Score: {quiz.quiz.passing_score}%
                {quiz.quiz.time_limit ? ` · Time Limit: ${quiz.quiz.time_limit} minutes` : ''}
              </p>
            </div>
            {remaining !== null && (
              <div
                role="timer"
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums sm:self-center',
                  urgent ? 'bg-danger-soft text-danger-fg' : 'bg-primary-soft text-primary-fg'
                )}
              >
                <Clock size={16} aria-hidden="true" />
                Time left: {formatClock(remaining)}
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={done} max={quiz.questions.length} size="sm" label="Questions answered" />
            <span className="shrink-0 text-xs text-fg-muted tabular-nums">
              {done}/{quiz.questions.length} answered
            </span>
          </div>
        </Card>

        <ol className="space-y-4">
          {quiz.questions.map((question, index) => (
            <li key={question.id}>
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-fg">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-fg">{question.text}</h4>
                    <p className="mt-1 text-xs text-fg-subtle">
                      {question.points} point{question.points !== 1 ? 's' : ''} · {TYPE_LABELS[question.type] || question.type}
                    </p>

                    {(question.type === 'multiple_choice' || question.type === 'true_false') && (
                      <div className="mt-4 space-y-2">
                        {question.options.map((option) => (
                          <label key={option.id} className={OPTION}>
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value={option.id}
                              onChange={(e) => answer(question.id, { selected_option: e.target.value })}
                              className="h-4 w-4 shrink-0 accent-primary"
                            />
                            <span>{option.text}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {question.type === 'multiple_select' && (
                      <div className="mt-4 space-y-2">
                        {question.options.map((option) => (
                          <label key={option.id} className={OPTION}>
                            <input
                              type="checkbox"
                              value={option.id}
                              onChange={(e) => {
                                // nothing is given until the first box is ticked
                                const given: QuizAnswer | undefined = answers[question.id];
                                const current = given && 'selected_options' in given ? given.selected_options : [];
                                const next = e.target.checked
                                  ? [...current, option.id]
                                  : current.filter((id) => id !== option.id);
                                answer(question.id, { selected_options: next });
                              }}
                              className="h-4 w-4 shrink-0 rounded accent-primary"
                            />
                            <span>{option.text}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {question.type === 'fill_blank' && (
                      <input
                        type="text"
                        aria-label={`Answer to question ${index + 1}`}
                        placeholder="Enter your answer..."
                        onChange={(e) => answer(question.id, { text_answer: e.target.value })}
                        className={inputClasses(false, 'mt-4 h-10 px-3')}
                      />
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>

        <Card className="flex flex-col-reverse gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={exit}>
            Exit Quiz
          </Button>
          <Button variant="success" icon={Send} onClick={submit} loading={busy}>
            {busy ? 'Submitting...' : 'Submit Quiz'}
          </Button>
        </Card>
      </div>
    );
  }

  if (mode === 'results' && results) {
    const passed = results.passed;
    return (
      <Card className="mx-auto max-w-2xl overflow-hidden">
        <div className={cn('px-6 py-8 text-center', passed ? 'bg-success-soft' : 'bg-danger-soft')}>
          <span
            className={cn(
              'mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-sm',
              passed ? 'text-success-fg' : 'text-danger-fg'
            )}
          >
            {passed ? <Trophy size={26} aria-hidden="true" /> : <XCircle size={26} aria-hidden="true" />}
          </span>
          <div className={cn('mt-4 text-5xl font-bold tracking-tight tabular-nums', passed ? 'text-success-fg' : 'text-danger-fg')}>
            {Math.round(results.score)}%
          </div>
          <h3 className="mt-2 text-lg font-semibold text-fg">
            {results.passed
              ? 'Quiz Passed!'
              : results.current_attempt_passed
                ? 'Great! But You Already Passed Before'
                : 'Quiz Not Passed'}
          </h3>
          {results.best_score !== results.score && (
            <p className="mt-1 text-sm text-fg-muted">
              <span className="font-medium">Your Best Score:</span> {Math.round(results.best_score)}%
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
          <Metric label="This attempt" value={`${results.earned_points}/${results.total_points} points`} />
          <Metric label="Passing score" value={`${results.passing_score}%`} />
          <Metric label="Attempt" value={`${results.attempt_number}/${results.attempt_number + results.attempts_remaining}`} />
          <Metric label="Status" value={passed ? 'PASSED' : 'NOT PASSED'} tone={passed ? 'success' : 'danger'} />
        </div>
        <div className="flex justify-center border-t border-line p-4">
          <Button onClick={exit}>Continue Learning</Button>
        </div>
      </Card>
    );
  }

  const exhausted = !lecture.can_attempt && lecture.attempts_taken >= lecture.max_attempts;

  return (
    <div className="space-y-4">
      {timeUp && (
        <Callout tone="danger" role="alert" title="Time is up">
          The time limit ran out before your answers were handed in, so this attempt was closed.
        </Callout>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-start gap-4 border-b border-line p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-fg">
            <FileQuestion size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-fg">Quiz Information</h3>
            <p className="mt-0.5 text-sm text-fg-muted">
              Answer every question, then hand the quiz in. Your best attempt counts.
            </p>
          </div>
          <Badge tone={lecture.passed ? 'success' : 'neutral'} icon={lecture.passed ? CheckCircle2 : undefined}>
            {lecture.passed ? 'Passed' : 'Not Passed'}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
          <Metric label="Attempts" value={`${lecture.attempts_taken}/${lecture.max_attempts}`} />
          <Metric label="Passing Score" value={`${lecture.passing_score}%`} />
          <Metric label="Best Score" value={`${lecture.best_score}%`} tone={lecture.passed ? 'success' : 'default'} />
        </div>
        <div className="flex flex-col items-center gap-2 border-t border-line p-5">
          <Button
            size="lg"
            icon={lecture.attempts_taken === 0 ? PlayCircle : RotateCcw}
            onClick={start}
            disabled={!lecture.can_attempt}
            loading={busy}
          >
            {busy ? 'Loading...' : lecture.attempts_taken === 0 ? 'Start Quiz' : 'Retake Quiz'}
          </Button>
          {exhausted && <p className="text-sm font-medium text-danger-fg">Maximum attempts reached</p>}
        </div>
      </Card>
    </div>
  );
};

export default QuizRunner;
