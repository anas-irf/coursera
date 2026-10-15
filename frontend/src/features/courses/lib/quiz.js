/**
 * Immutable edits of the questions of a quiz form.
 *
 * The questions of a quiz that is being edited are the objects the course data holds: changing
 * them in place changes the data behind the dialog, so "Cancel" would not cancel.  Every function
 * here returns new objects, and keeps the ``id`` a question or an option came with so that
 * saving updates it instead of recreating it (which would drop the answers given to it).
 */

export const OPTIONS_PER_QUESTION = 4;

/** A question with empty options, ready to be filled in. */
export const newQuestion = () => ({
  question_text: '',
  question_type: 'multiple_choice',
  points: 1,
  explanation: '',
  options: Array.from({ length: OPTIONS_PER_QUESTION }, (_, order) => ({
    option_text: '',
    is_correct: false,
    order,
  })),
});

/** ``questions`` with ``field`` of the question at ``index`` set to ``value``. */
export const setQuestionField = (questions, index, field, value) =>
  questions.map((question, position) => (position === index ? { ...question, [field]: value } : question));

/**
 * ``questions`` with ``field`` of one option set.  A question has one correct answer: marking an
 * option correct unmarks the others.
 */
export const setOptionField = (questions, questionIndex, optionIndex, field, value) =>
  questions.map((question, position) => {
    if (position !== questionIndex) return question;

    const options = question.options.map((option, current) => {
      if (current === optionIndex) return { ...option, [field]: value };
      if (field === 'is_correct' && value && option.is_correct) return { ...option, is_correct: false };
      return option;
    });
    return { ...question, options };
  });

/** ``questions`` without the one at ``index``. */
export const removeQuestionAt = (questions, index) => questions.filter((_, position) => position !== index);
