import React, { useEffect, useState } from 'react';

import { errorMessage } from '../../../shared/api/errors';
import { useToast } from '../../../shared/ui/Toast';
import * as assessmentsApi from '../api';

/**
 * A quiz lecture: overview -> taking -> results.
 *
 * ``onActiveChange(true)`` is called while an attempt is open so the player can
 * ask before the student leaves the quiz; ``onFinished`` after a submission so
 * the player reloads progress.
 */
const QuizRunner = ({ lecture, onFinished, onActiveChange }) => {
  const toast = useToast();
  const [mode, setMode] = useState(null); // null | 'taking' | 'results'
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (onActiveChange) onActiveChange(mode === 'taking');
    return () => {
      if (onActiveChange) onActiveChange(false);
    };
  }, [mode, onActiveChange]);

  const start = async () => {
    setBusy(true);
    try {
      setQuiz(await assessmentsApi.startQuiz(lecture.quiz_id));
      setAnswers({});
      setResults(null);
      setMode('taking');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to start quiz. Please try again.'), 'Quiz Error');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!quiz) return;
    setBusy(true);
    try {
      const data = await assessmentsApi.submitQuiz(quiz.quiz.id, quiz.attempt_id, answers);
      setResults(data.results);
      setMode('results');
      if (onFinished) await onFinished();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to submit quiz. Please try again.'), 'Quiz Submission Failed');
    } finally {
      setBusy(false);
    }
  };

  const exit = () => {
    setMode(null);
    setQuiz(null);
    setAnswers({});
    setResults(null);
  };

  const answer = (questionId, value) => setAnswers((prev) => ({ ...prev, [questionId]: value }));

  return (
    <div className="p-4 sm:p-6">
      {mode === null && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Quiz Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Attempts:</span> {lecture.attempts_taken}/{lecture.max_attempts}
              </div>
              <div>
                <span className="text-blue-700">Passing Score:</span> {lecture.passing_score}%
              </div>
              <div>
                <span className="text-blue-700">Best Score:</span> {lecture.best_score}%
              </div>
              <div>
                <span className="text-blue-700">Status:</span>
                <span className={`ml-1 ${lecture.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {lecture.passed ? 'Passed' : 'Not Passed'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={start}
              disabled={!lecture.can_attempt || busy}
              className={`px-6 py-3 rounded-lg font-medium ${
                lecture.can_attempt && !busy
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {busy ? 'Loading...' : lecture.attempts_taken === 0 ? 'Start Quiz' : 'Retake Quiz'}
            </button>
            {!lecture.can_attempt && lecture.attempts_taken >= lecture.max_attempts && (
              <p className="mt-2 text-sm text-red-600">Maximum attempts reached</p>
            )}
          </div>
        </>
      )}

      {mode === 'taking' && quiz && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium text-blue-900">{quiz.quiz.title}</h3>
                <p className="text-sm text-blue-700 mt-1">{quiz.quiz.description}</p>
              </div>
              <div className="text-right text-sm text-blue-700">
                <div>Passing Score: {quiz.quiz.passing_score}%</div>
                {quiz.quiz.time_limit && <div>Time Limit: {quiz.quiz.time_limit} minutes</div>}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {quiz.questions.map((question, index) => (
              <div key={question.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start space-x-3 mb-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">{question.text}</h4>
                    <div className="text-sm text-gray-500 mb-4">
                      {question.points} point{question.points !== 1 ? 's' : ''} •{' '}
                      {question.type.replace('_', ' ').toUpperCase()}
                    </div>

                    {(question.type === 'multiple_choice' || question.type === 'true_false') && (
                      <div className="space-y-2">
                        {question.options.map((option) => (
                          <label
                            key={option.id}
                            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value={option.id}
                              onChange={(e) => answer(question.id, { selected_option: e.target.value })}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-gray-900">{option.text}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {question.type === 'multiple_select' && (
                      <div className="space-y-2">
                        {question.options.map((option) => (
                          <label
                            key={option.id}
                            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              value={option.id}
                              onChange={(e) => {
                                const current =
                                  (answers[question.id] && answers[question.id].selected_options) || [];
                                const next = e.target.checked
                                  ? [...current, option.id]
                                  : current.filter((id) => id !== option.id);
                                answer(question.id, { selected_options: next });
                              }}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-gray-900">{option.text}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {question.type === 'fill_blank' && (
                      <input
                        type="text"
                        placeholder="Enter your answer..."
                        onChange={(e) => answer(question.id, { text_answer: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-8 p-6 bg-gray-50 rounded-lg">
            <button onClick={exit} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">
              Exit Quiz
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className={`px-6 py-3 rounded-lg font-medium ${
                busy ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {busy ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        </div>
      )}

      {mode === 'results' && results && (
        <div className="max-w-2xl mx-auto">
          <div
            className={`border-2 rounded-lg p-6 mb-6 ${
              results.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="text-center">
              <div className={`text-6xl font-bold mb-2 ${results.passed ? 'text-green-600' : 'text-red-600'}`}>
                {Math.round(results.score)}%
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${results.passed ? 'text-green-900' : 'text-red-900'}`}>
                {results.passed
                  ? 'Quiz Passed!'
                  : results.current_attempt_passed
                    ? 'Great! But You Already Passed Before'
                    : 'Quiz Not Passed'}
              </h3>

              {results.best_score !== results.score && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-700">
                    <span className="font-medium">Your Best Score:</span> {Math.round(results.best_score)}%
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                <div>
                  <span className="font-medium">This Attempt:</span> {results.earned_points}/{results.total_points}{' '}
                  points
                </div>
                <div>
                  <span className="font-medium">Passing Score:</span> {results.passing_score}%
                </div>
                <div>
                  <span className="font-medium">Attempt:</span> {results.attempt_number}/
                  {results.attempt_number + results.attempts_remaining}
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-1 font-semibold ${results.passed ? 'text-green-600' : 'text-red-600'}`}>
                    {results.passed ? 'PASSED' : 'NOT PASSED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button onClick={exit} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Continue Learning
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizRunner;
