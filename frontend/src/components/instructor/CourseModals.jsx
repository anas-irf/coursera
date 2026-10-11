import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import CurriculumTab from './CurriculumTab';
import { useToast } from '../shared/Toast';

// Create Course Modal
export const CreateCourseModal = ({ onClose, onSave }) => {
  const { success, error: showError, warning } = useToast();

  // Language mapping - we'll use IDs that should exist or can be created
  const languageMap = {
    'en': 1, 'es': 2, 'zh': 3, 'hi': 4, 'ar': 5,
    'pt': 6, 'ru': 7, 'ja': 8, 'fr': 9, 'de': 10,
    'ko': 11, 'it': 12, 'tr': 13, 'pl': 14, 'nl': 15,
    'sv': 16, 'da': 17, 'no': 18, 'fi': 19, 'he': 20,
    'th': 21, 'vi': 22, 'id': 23, 'ms': 24, 'tl': 25,
    'uk': 26, 'cs': 27, 'hu': 28, 'ro': 29, 'el': 30
  };

  const [courseData, setCourseData] = useState({
    title: '',
    subtitle: '',
    description: '',
    category: '',
    level: 'beginner',
    language: 'en', // English language code
    course_type: 'coursera_plus', // FREE or COURSERA_PLUS
    estimated_hours: 10,
  });

  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [thumbnailError, setThumbnailError] = useState('');

  // File validation function
  const validateThumbnailFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid image file (JPEG, JPG, PNG, or WebP)';
    }

    if (file.size > maxSize) {
      return 'File size must be less than 5MB';
    }

    return null;
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    setThumbnailError('');

    if (!file) {
      setThumbnailFile(null);
      setThumbnailPreview(null);
      return;
    }

    const error = validateThumbnailFile(file);
    if (error) {
      setThumbnailError(error);
      setThumbnailFile(null);
      setThumbnailPreview(null);
      e.target.value = ''; // Clear the input
      return;
    }

    setThumbnailFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setThumbnailPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!courseData.title || !courseData.description) {
      warning('Please fill in required fields (Title and Description)', 'Missing Information');
      return;
    }

    if (!thumbnailFile) {
      warning('Please upload a course thumbnail', 'Missing Thumbnail');
      return;
    }
    
    try {
      // Generate slug from title
      const slug = courseData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .trim('-'); // Remove leading/trailing hyphens
      
      // Create FormData to handle file upload
      const formData = new FormData();
      formData.append('title', courseData.title);
      formData.append('subtitle', courseData.subtitle || '');
      formData.append('description', courseData.description);
      // Don't append category if empty - let backend handle null
      formData.append('level', courseData.level);
      // Skip language for now - it's nullable in the model
      // formData.append('language', languageMap[courseData.language] || 1);
      formData.append('course_type', courseData.course_type);
      formData.append('estimated_hours', courseData.estimated_hours);
      formData.append('slug', slug);
      formData.append('status', 'draft');
      
      // Add the uploaded thumbnail file
      formData.append('thumbnail', thumbnailFile);
        
      console.log('Creating course with FormData');
      const response = await api.post('/courses/instructor/courses/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('Course created successfully:', response.data);
      
      // Show success message
      success('Course created successfully! You can now edit it and add content.', 'Course Created');

      onSave(); // This will refresh the courses list and close the modal
    } catch (err) {
      console.error('Error creating course:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);

      // Show more specific error message
      let errorMessage = 'Unknown error occurred';

      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data.non_field_errors) {
          errorMessage = err.response.data.non_field_errors.join(', ');
        } else {
          // Handle field validation errors
          const fieldErrors = [];
          for (const [field, errors] of Object.entries(err.response.data)) {
            if (Array.isArray(errors)) {
              fieldErrors.push(`${field}: ${errors.join(', ')}`);
            } else {
              fieldErrors.push(`${field}: ${errors}`);
            }
          }
          if (fieldErrors.length > 0) {
            errorMessage = fieldErrors.join('. ');
          } else {
            errorMessage = JSON.stringify(err.response.data);
          }
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      showError(errorMessage, 'Course Creation Failed');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Create New Course</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course Title *
            </label>
            <input
              type="text"
              value={courseData.title}
              onChange={(e) => setCourseData({...courseData, title: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Complete React Developer Course"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subtitle
            </label>
            <input
              type="text"
              value={courseData.subtitle}
              onChange={(e) => setCourseData({...courseData, subtitle: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Brief description of your course"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={courseData.description}
              onChange={(e) => setCourseData({...courseData, description: e.target.value})}
              rows="4"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="What will students learn in this course?"
            />
          </div>

          {/* Course Thumbnail Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course Thumbnail *
            </label>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                    </svg>
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> course thumbnail
                    </p>
                    <p className="text-xs text-gray-500">JPEG, JPG, PNG or WebP (Max 5MB)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleThumbnailChange}
                  />
                </label>
              </div>
              
              {thumbnailError && (
                <p className="text-sm text-red-600">{thumbnailError}</p>
              )}
              
              {thumbnailPreview && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                  <div className="relative inline-block">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="h-24 w-auto rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setThumbnailFile(null);
                        setThumbnailPreview(null);
                        setThumbnailError('');
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Level
              </label>
              <select
                value={courseData.level}
                onChange={(e) => setCourseData({...courseData, level: e.target.value})}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                value={courseData.language}
                onChange={(e) => setCourseData({...courseData, language: e.target.value})}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="zh">Chinese (Mandarin)</option>
                <option value="hi">Hindi</option>
                <option value="ar">Arabic</option>
                <option value="pt">Portuguese</option>
                <option value="ru">Russian</option>
                <option value="ja">Japanese</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ko">Korean</option>
                <option value="it">Italian</option>
                <option value="tr">Turkish</option>
                <option value="pl">Polish</option>
                <option value="nl">Dutch</option>
                <option value="sv">Swedish</option>
                <option value="da">Danish</option>
                <option value="no">Norwegian</option>
                <option value="fi">Finnish</option>
                <option value="he">Hebrew</option>
                <option value="th">Thai</option>
                <option value="vi">Vietnamese</option>
                <option value="id">Indonesian</option>
                <option value="ms">Malay</option>
                <option value="tl">Filipino</option>
                <option value="uk">Ukrainian</option>
                <option value="cs">Czech</option>
                <option value="hu">Hungarian</option>
                <option value="ro">Romanian</option>
                <option value="el">Greek</option>
              </select>
            </div>
          </div>
          
          <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Course Type
          </label>
          <select
            value={courseData.course_type}
            onChange={(e) => setCourseData({...courseData, course_type: e.target.value})}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="coursera_plus">Coursera Plus (Paid via subscription)</option>
            <option value="free">Free Course (No earnings)</option>
          </select>
          {courseData.course_type === 'free' && (
            <p className="text-sm text-gray-500 mt-1">
              Free courses don't generate instructor earnings
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estimated Hours to Complete
          </label>
          <input
            type="number"
            value={courseData.estimated_hours}
            onChange={(e) => setCourseData({...courseData, estimated_hours: parseFloat(e.target.value)})}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            min="1"
            step="0.5"
          />
        </div>
          
          <div className="flex gap-4 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700"
            >
              Create Course
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Course Modal
export const EditCourseModal = ({ course, onClose, onSave }) => {
  const { success, error: showError, warning } = useToast();

  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const [courseData, setCourseData] = useState({
    title: course?.title || '',
    subtitle: '',
    description: '',
    level: 'beginner',
    course_type: course?.course_type || 'coursera_plus',
    estimated_hours: 10,
  });

  // Fetch complete course details when modal opens
  useEffect(() => {
    const fetchCourseDetails = async () => {
      if (!course?.id) return;

      setFetchingDetails(true);
      try {
        const response = await api.get(`/courses/instructor/courses/${course.id}/`);
        const fullCourseData = response.data;

        setCourseData({
          title: fullCourseData.title || '',
          subtitle: fullCourseData.subtitle || '',
          description: fullCourseData.description || '',
          level: fullCourseData.level || 'beginner',
          course_type: fullCourseData.course_type || 'coursera_plus',
          estimated_hours: fullCourseData.estimated_hours || 10,
        });

      } catch (error) {
        console.error('Error fetching course details:', error);
        // Fallback to whatever data we have
        setCourseData({
          title: course.title || '',
          subtitle: '',
          description: '',
          level: 'beginner',
          course_type: course.course_type || 'coursera_plus',
          estimated_hours: 10,
        });
      } finally {
        setFetchingDetails(false);
      }
    };

    fetchCourseDetails();
  }, [course?.id]);

  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [thumbnailError, setThumbnailError] = useState('');

  // File validation function
  const validateThumbnailFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid image file (JPEG, JPG, PNG, or WebP)';
    }

    if (file.size > maxSize) {
      return 'File size must be less than 5MB';
    }

    return null;
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    setThumbnailError('');

    if (!file) {
      setThumbnailFile(null);
      setThumbnailPreview(null);
      return;
    }

    const error = validateThumbnailFile(file);
    if (error) {
      setThumbnailError(error);
      setThumbnailFile(null);
      setThumbnailPreview(null);
      e.target.value = ''; // Clear the input
      return;
    }

    setThumbnailFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setThumbnailPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!courseData.title || !courseData.description) {
      warning('Please fill in required fields (Title and Description)', 'Missing Information');
      return;
    }

    setLoading(true);
    try {
      // Generate slug from title (same logic as create modal)
      const slug = courseData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .trim('-'); // Remove leading/trailing hyphens

      // If no thumbnail is being updated, use regular JSON data (no multipart/form-data)
      if (!thumbnailFile) {
        const updateData = {
          title: courseData.title,
          subtitle: courseData.subtitle || '',
          description: courseData.description,
          level: courseData.level,
          course_type: courseData.course_type,
          estimated_hours: courseData.estimated_hours,
          slug: slug, // Include the generated slug
        };

        const response = await api.patch(`/courses/instructor/courses/${course.id}/`, updateData, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else {
        // Only use FormData when uploading a new thumbnail
        const formData = new FormData();
        formData.append('title', courseData.title);
        formData.append('subtitle', courseData.subtitle || '');
        formData.append('description', courseData.description);
        formData.append('level', courseData.level);
        formData.append('course_type', courseData.course_type);
        formData.append('estimated_hours', courseData.estimated_hours);
        formData.append('slug', slug); // Include the generated slug
        formData.append('thumbnail', thumbnailFile);

        const response = await api.patch(`/courses/instructor/courses/${course.id}/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      success('Course updated successfully!', 'Course Updated');
      onSave(); // This will refresh the courses list and close the modal
    } catch (err) {
      console.error('Error updating course:', err);

      // Show more specific error message
      let errorMessage = 'Unknown error occurred';

      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data.non_field_errors) {
          errorMessage = err.response.data.non_field_errors.join(', ');
        } else {
          // Handle field validation errors
          const fieldErrors = [];
          for (const [field, errors] of Object.entries(err.response.data)) {
            if (Array.isArray(errors)) {
              fieldErrors.push(`${field}: ${errors.join(', ')}`);
            } else {
              fieldErrors.push(`${field}: ${errors}`);
            }
          }
          if (fieldErrors.length > 0) {
            errorMessage = fieldErrors.join('. ');
          } else {
            errorMessage = JSON.stringify(err.response.data);
          }
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      showError(errorMessage, 'Course Update Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white border-b">
          <div className="p-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Edit Course: {course.title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>
          
          <div className="px-6 flex space-x-8">
            {['basic', 'curriculum', 'pricing', 'settings'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-6">
          {fetchingDetails && (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading course details...</div>
            </div>
          )}

          {!fetchingDetails && activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course Title *
                </label>
                <input
                  type="text"
                  value={courseData.title}
                  onChange={(e) => setCourseData({...courseData, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter course title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={courseData.subtitle}
                  onChange={(e) => setCourseData({...courseData, subtitle: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Brief description of your course"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  rows="4"
                  value={courseData.description}
                  onChange={(e) => setCourseData({...courseData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="What will students learn in this course?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Level
                  </label>
                  <select
                    value={courseData.level}
                    onChange={(e) => setCourseData({...courseData, level: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    value={courseData.estimated_hours}
                    onChange={(e) => setCourseData({...courseData, estimated_hours: parseFloat(e.target.value) || 0})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="1"
                    step="0.5"
                  />
                </div>
              </div>

              {/* Course Thumbnail Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course Thumbnail
                </label>

                {/* Current Thumbnail Display */}
                {course?.thumbnail && !thumbnailPreview && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Current thumbnail:</p>
                    <img
                      src={course.thumbnail}
                      alt="Current course thumbnail"
                      className="h-24 w-auto rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {/* Thumbnail Upload */}
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                        </svg>
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to change</span> course thumbnail
                        </p>
                        <p className="text-xs text-gray-500">JPEG, JPG, PNG or WebP (Max 5MB) - Optional</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleThumbnailChange}
                      />
                    </label>
                  </div>

                  {thumbnailError && (
                    <p className="text-sm text-red-600">{thumbnailError}</p>
                  )}

                  {thumbnailPreview && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">New thumbnail preview:</p>
                      <div className="relative inline-block">
                        <img
                          src={thumbnailPreview}
                          alt="New thumbnail preview"
                          className="h-24 w-auto rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setThumbnailFile(null);
                            setThumbnailPreview(null);
                            setThumbnailError('');
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!fetchingDetails && activeTab === 'curriculum' && (
            <CurriculumTab courseId={course.id} />
          )}

          {!fetchingDetails && activeTab === 'pricing' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course Type
                </label>
                <select
                  value={courseData.course_type}
                  onChange={(e) => setCourseData({...courseData, course_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="coursera_plus">Coursera Plus (Subscription-based)</option>
                  <option value="free">Free Course</option>
                </select>
                <p className="text-sm text-gray-500 mt-2">
                  {courseData.course_type === 'free'
                    ? 'Free courses are available to all users but don\'t generate instructor earnings.'
                    : 'Coursera Plus courses generate earnings based on student engagement and completion rates.'
                  }
                </p>
              </div>
            </div>
          )}
          
          {!fetchingDetails && activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Course Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" />
                    <span className="text-sm text-gray-700">Enable course discussions</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" />
                    <span className="text-sm text-gray-700">Allow content downloads</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" />
                    <span className="text-sm text-gray-700">Issue certificate on completion</span>
                  </label>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-4 mt-8">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};