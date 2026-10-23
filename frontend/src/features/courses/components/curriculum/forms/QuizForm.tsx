import React, { useState } from 'react';
import { Award, Dumbbell, ListChecks, Plus, Trash2 } from 'lucide-react';

import { cn } from '../../../../../shared/lib/cn';
import { Badge } from '../../../../../shared/ui/Badge';
import { Button, IconButton } from '../../../../../shared/ui/Button';
import { Field } from '../../../../../shared/ui/Field';
import { Input, Textarea } from '../../../../../shared/ui/Input';
import { SegmentedControl } from '../../../../../shared/ui/SegmentedControl';
import { newQuestion, removeQuestionAt, setOptionField, setQuestionField } from '../../../lib/quiz';
import type { LectureFormData, QuizOption, QuizQuestion, QuizSettings } from '../../../types';

interface QuizFormProps {
  formData: LectureFormData;
  setFormData: (formData: LectureFormData) => void;
}

/** A quiz is practice (ungraded, weight 0) or graded (it carries a share of the final grade). */
type QuizType = 'practice' | 'graded';

const letter = (index: number): string => String.fromCharCode(65 + index);

const QuizForm = ({ formData, setFormData }: QuizFormProps) => {
  // Determine quiz type based on weight (0 = practice, > 0 = graded)
  const [quizType, setQuizType] = useState<QuizType>(
    formData.quiz_settings?.weight && formData.quiz_settings.weight > 0 ? 'graded' : 'practice'
  );

  const updateQuizSettings = <K extends keyof QuizSettings>(field: K, value: QuizSettings[K]) => {
    setFormData({
      ...formData,
      quiz_settings: {
        ...formData.quiz_settings,
        [field]: value
      }
    });
  };

  // Update quiz type when radio buttons change
  const handleQuizTypeChange = (type: QuizType) => {
    setQuizType(type);
    // If switching to practice, set weight to 0
    if (type === 'practice') {
      updateQuizSettings('weight', 0);
    }
    // If switching to graded and weight is 0, set a default weight
    else if (type === 'graded' && (!formData.quiz_settings?.weight || formData.quiz_settings.weight === 0)) {
      updateQuizSettings('weight', 10);
    }
  };

  // the questions are edited as copies: the dialog's "Cancel" must leave the course data alone
  const addQuestion = () => {
    setFormData({ ...formData, questions: [...(formData.questions || []), newQuestion()] });
  };

  const removeQuestion = (index: number) => {
    setFormData({ ...formData, questions: removeQuestionAt(formData.questions, index) });
  };

  const updateQuestion = <K extends keyof QuizQuestion>(
    questionIndex: number,
    field: K,
    value: QuizQuestion[K]
  ) => {
    setFormData({ ...formData, questions: setQuestionField(formData.questions, questionIndex, field, value) });
  };

  const updateOption = <K extends keyof QuizOption>(
    questionIndex: number,
    optionIndex: number,
    field: K,
    value: QuizOption[K]
  ) => {
    setFormData({
      ...formData,
      questions: setOptionField(formData.questions, questionIndex, optionIndex, field, value),
    });
  };

  const questions = formData.questions || [];

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-fg">Quiz type</p>
        <SegmentedControl
          label="Quiz type"
          variant="cards"
          value={quizType}
          onChange={handleQuizTypeChange}
          options={[
            {
              value: 'practice',
              label: 'Practice Quiz (Ungraded)',
              icon: Dumbbell,
              description: 'For learners to check themselves; it does not count towards the grade.',
            },
            {
              value: 'graded',
              label: 'Graded Quiz',
              icon: Award,
              description: 'Counts towards the final grade with the weight you give it.',
            },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Time limit (minutes)" hint="Leave it empty for no limit.">
          <Input
            type="number"
            min="1"
            value={formData.quiz_settings?.time_limit || ''}
            onChange={(e) => updateQuizSettings('time_limit', parseInt(e.target.value) || null)}
            placeholder="30"
          />
        </Field>
        <Field label="Max attempts">
          <Input
            type="number"
            min="1"
            max="10"
            value={formData.quiz_settings?.max_attempts || ''}
            onChange={(e) => updateQuizSettings('max_attempts', parseInt(e.target.value) || 3)}
            placeholder="3"
          />
        </Field>
        {quizType === 'graded' && (
          <>
            <Field label="Passing score (%)">
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.quiz_settings?.passing_score || ''}
                onChange={(e) => updateQuizSettings('passing_score', parseInt(e.target.value) || 60)}
                placeholder="70"
              />
            </Field>
            <Field label="Weight in grade (%)" hint="From 0.01 to 40.">
              <Input
                type="number"
                min="0.01"
                max="40"
                step="0.01"
                value={formData.quiz_settings?.weight || ''}
                onChange={(e) => updateQuizSettings('weight', parseFloat(e.target.value) || 0)}
                placeholder="10.00"
              />
            </Field>
          </>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
            Quiz Questions
            <Badge tone="primary">{questions.length}</Badge>
          </h4>
          <Button variant="soft" size="sm" icon={Plus} onClick={addQuestion}>
            Add Question
          </Button>
        </div>

        {questions.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-strong px-6 py-8 text-center">
            <ListChecks size={22} aria-hidden="true" className="text-fg-subtle" />
            <p className="text-sm text-fg-muted">No questions added yet. Click "Add Question" to get started.</p>
          </div>
        )}

        <div className="space-y-4">
          {questions.map((question, questionIndex) => (
            <div key={questionIndex} className="space-y-4 rounded-xl border border-line bg-surface-muted/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-fg">Question {questionIndex + 1}</span>
                <IconButton
                  icon={Trash2}
                  label={`Remove question ${questionIndex + 1}`}
                  size="sm"
                  onClick={() => removeQuestion(questionIndex)}
                />
              </div>

              <Field label="Question text" required>
                <Textarea
                  value={question.question_text}
                  onChange={(e) => updateQuestion(questionIndex, 'question_text', e.target.value)}
                  rows={2}
                  placeholder="Enter your question here..."
                />
              </Field>

              <fieldset>
                <legend className="text-sm font-medium text-fg">Answer options</legend>
                <p className="text-xs text-fg-subtle">Select the radio button next to the correct answer.</p>
                <div className="mt-2 space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                        option.is_correct ? 'border-success-fg/40 bg-success-soft' : 'border-line bg-surface'
                      )}
                    >
                      <input
                        type="radio"
                        name={`question-${questionIndex}`}
                        checked={option.is_correct}
                        onChange={(e) => updateOption(questionIndex, optionIndex, 'is_correct', e.target.checked)}
                        aria-label={`Option ${letter(optionIndex)} is the correct answer`}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-success"
                      />
                      <span className="w-4 shrink-0 text-xs font-semibold text-fg-subtle">{letter(optionIndex)}</span>
                      <Input
                        value={option.option_text}
                        onChange={(e) => updateOption(questionIndex, optionIndex, 'option_text', e.target.value)}
                        aria-label={`Option ${letter(optionIndex)} of question ${questionIndex + 1}`}
                        placeholder={`Option ${optionIndex + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuizForm;
