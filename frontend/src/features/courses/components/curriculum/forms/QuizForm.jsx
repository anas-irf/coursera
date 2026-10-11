import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const QuizForm = ({ formData, setFormData }) => {
  // Determine quiz type based on weight (0 = practice, > 0 = graded)
  const [quizType, setQuizType] = useState(
    formData.quiz_settings?.weight && formData.quiz_settings.weight > 0 ? 'graded' : 'practice'
  );

  const updateQuizSettings = (field, value) => {
    setFormData({
      ...formData,
      quiz_settings: {
        ...formData.quiz_settings,
        [field]: value
      }
    });
  };

  // Update quiz type when radio buttons change
  const handleQuizTypeChange = (type) => {
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

  const createNewQuestion = () => ({
    question_text: '',
    question_type: 'multiple_choice',
    points: 1,
    explanation: '',
    options: [
      { option_text: '', is_correct: false, order: 0 },
      { option_text: '', is_correct: false, order: 1 },
      { option_text: '', is_correct: false, order: 2 },
      { option_text: '', is_correct: false, order: 3 }
    ]
  });

  const addQuestion = () => {
    const newQuestions = [...(formData.questions || []), createNewQuestion()];
    setFormData({ ...formData, questions: newQuestions });
  };

  const removeQuestion = (index) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateQuestion = (questionIndex, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[questionIndex][field] = value;
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateOption = (questionIndex, optionIndex, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[questionIndex].options[optionIndex][field] = value;

    if (field === 'is_correct' && value) {
      newQuestions[questionIndex].options.forEach((opt, i) => {
        if (i !== optionIndex) opt.is_correct = false;
      });
    }

    setFormData({ ...formData, questions: newQuestions });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Quiz Type
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="practice"
              checked={quizType === 'practice'}
              onChange={(e) => handleQuizTypeChange(e.target.value)}
              className="text-indigo-600"
            />
            <span className="text-sm">Practice Quiz (Ungraded)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="graded"
              checked={quizType === 'graded'}
              onChange={(e) => handleQuizTypeChange(e.target.value)}
              className="text-indigo-600"
            />
            <span className="text-sm">Graded Quiz</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Limit (minutes)
          </label>
          <input
            type="number"
            min="1"
            value={formData.quiz_settings?.time_limit || ''}
            onChange={(e) => updateQuizSettings('time_limit', parseInt(e.target.value) || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Attempts
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={formData.quiz_settings?.max_attempts || ''}
            onChange={(e) => updateQuizSettings('max_attempts', parseInt(e.target.value) || 3)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="3"
          />
        </div>
      </div>

      {quizType === 'graded' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Passing Score (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.quiz_settings?.passing_score || ''}
              onChange={(e) => updateQuizSettings('passing_score', parseInt(e.target.value) || 60)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="70"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weight in Grade
            </label>
            <input
              type="number"
              min="0.01"
              max="40"
              step="0.01"
              value={formData.quiz_settings?.weight || ''}
              onChange={(e) => updateQuizSettings('weight', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="10.00"
            />
            <p className="text-xs text-gray-500 mt-1">
              Range: 0.01% - 40%
            </p>
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-medium text-gray-900">Quiz Questions</h4>
          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
          >
            <Plus size={16} />
            Add Question
          </button>
        </div>

        {!formData.questions?.length && (
          <div className="text-center py-8 text-gray-500">
            <p>No questions added yet. Click "Add Question" to get started.</p>
          </div>
        )}

        {formData.questions?.map((question, questionIndex) => (
          <div key={questionIndex} className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start mb-3">
              <h5 className="text-md font-medium text-gray-800">
                Question {questionIndex + 1}
              </h5>
              <button
                type="button"
                onClick={() => removeQuestion(questionIndex)}
                className="text-red-500 hover:text-red-700"
                title="Remove question"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question Text *
              </label>
              <textarea
                value={question.question_text}
                onChange={(e) => updateQuestion(questionIndex, 'question_text', e.target.value)}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter your question here..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Answer Options (select the correct one)
              </label>
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name={`question-${questionIndex}`}
                      checked={option.is_correct}
                      onChange={(e) => updateOption(questionIndex, optionIndex, 'is_correct', e.target.checked)}
                      className="text-green-600"
                    />
                    <input
                      type="text"
                      value={option.option_text}
                      onChange={(e) => updateOption(questionIndex, optionIndex, 'option_text', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={`Option ${optionIndex + 1}`}
                    />
                    <span className="text-xs text-gray-500 w-16">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Select the radio button next to the correct answer
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizForm;