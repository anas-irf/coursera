import React, { useState, useEffect } from 'react';
import { Upload, FileText, Type } from 'lucide-react';
import { mediaUrl } from '../../../../../shared/lib/media';

const ReadingForm = ({ formData, setFormData, readingFile, setReadingFile }) => {
  // Determine initial content type based on existing data
  const getInitialContentType = () => {
    // If there's article content, it's rich text
    if (formData.article_content) {
      return 'rich_text';
    }

    // If there's a reading document with a file, check the file type
    if (formData.reading_document?.file_type) {
      return formData.reading_document.file_type; // Will be 'markdown_file' or 'pdf_file'
    }

    // Default to rich text
    return 'rich_text';
  };

  const [contentType, setContentType] = useState(getInitialContentType);

  // Update content type when formData changes (important for editing)
  useEffect(() => {
    setContentType(getInitialContentType());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.reading_document, formData.article_content]);

  const handleContentTypeChange = (type) => {
    setContentType(type);
    // Clear other content when switching types
    if (type === 'rich_text') {
      setFormData({...formData, markdown_file: null, pdf_file: null});
      setReadingFile(null);
    } else if (type === 'markdown_file') {
      setFormData({...formData, article_content: '', pdf_file: null});
      setReadingFile(null);
    } else if (type === 'pdf_file') {
      setFormData({...formData, article_content: '', markdown_file: null});
      setReadingFile(null);
    }
  };

  const handleFileUpload = (file, fileType) => {
    if (fileType === 'markdown_file') {
      setFormData({...formData, markdown_file: file});
    } else if (fileType === 'pdf_file') {
      setFormData({...formData, pdf_file: file});
    }
    setReadingFile(file);
  };

  return (
    <div className="space-y-4">
      {/* Content Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Reading Content Type
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="rich_text"
              checked={contentType === 'rich_text'}
              onChange={(e) => handleContentTypeChange(e.target.value)}
              className="text-indigo-600"
            />
            <Type size={16} />
            <span className="text-sm">Rich Text</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="markdown_file"
              checked={contentType === 'markdown_file'}
              onChange={(e) => handleContentTypeChange(e.target.value)}
              className="text-indigo-600"
            />
            <FileText size={16} />
            <span className="text-sm">Markdown File</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="pdf_file"
              checked={contentType === 'pdf_file'}
              onChange={(e) => handleContentTypeChange(e.target.value)}
              className="text-indigo-600"
            />
            <Upload size={16} />
            <span className="text-sm">PDF File</span>
          </label>
        </div>
      </div>

      {/* Rich Text Content */}
      {contentType === 'rich_text' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reading Content *
          </label>
          <textarea
            rows="12"
            value={formData.article_content || ''}
            onChange={(e) => setFormData({...formData, article_content: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Write your reading content here. You can use markdown formatting..."
          />
          <p className="text-xs text-gray-500 mt-1">
            You can use markdown formatting for headings, lists, links, etc.
          </p>
        </div>
      )}

      {/* Markdown File Upload */}
      {contentType === 'markdown_file' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Markdown File *
          </label>

          {/* Show existing markdown file if available */}
          {(formData.markdown_file || (formData.reading_document?.file_type === 'markdown_file' && formData.reading_document?.existing_file)) && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">Current file:</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-900">
                  {formData.markdown_file?.name || formData.reading_document?.file_name || 'markdown file'}
                </span>
                {formData.reading_document?.existing_file && (
                  <a
                    href={mediaUrl(formData.reading_document.existing_file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    View
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">Upload markdown file</p>
            <p className="text-sm text-gray-500">Markdown files (.md, .markdown) up to 10MB</p>
            <input
              type="file"
              accept=".md,.markdown"
              onChange={(e) => {
                const file = e.target.files[0];
                handleFileUpload(file, 'markdown_file');
              }}
              className="hidden"
              id="markdown-upload"
            />
            <label
              htmlFor="markdown-upload"
              className="mt-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
            >
              Choose Markdown File
            </label>

            {/* Show selected file name */}
            {formData.markdown_file && (
              <p className="mt-2 text-sm text-green-600">
                Selected: {formData.markdown_file.name}
              </p>
            )}
          </div>
        </div>
      )}

      {/* PDF File Upload */}
      {contentType === 'pdf_file' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PDF File *
          </label>

          {/* Show existing PDF file if available */}
          {(formData.pdf_file || (formData.reading_document?.file_type === 'pdf_file' && formData.reading_document?.existing_file)) && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">Current file:</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-900">
                  {formData.pdf_file?.name || formData.reading_document?.file_name || 'PDF file'}
                </span>
                {formData.reading_document?.existing_file && (
                  <a
                    href={mediaUrl(formData.reading_document.existing_file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    View
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">
              {(formData.reading_document?.file_type === 'pdf_file' && formData.reading_document?.existing_file)
                ? 'Upload new PDF to replace current reading'
                : 'Upload PDF document'}
            </p>
            <p className="text-sm text-gray-500">PDF files up to 50MB</p>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files[0];
                handleFileUpload(file, 'pdf_file');
              }}
              className="hidden"
              id="pdf-upload"
            />
            <label
              htmlFor="pdf-upload"
              className="mt-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
            >
              {(formData.reading_document?.file_type === 'pdf_file' && formData.reading_document?.existing_file) ? 'Replace PDF' : 'Choose PDF File'}
            </label>

            {/* Show selected file name */}
            {formData.pdf_file && (
              <p className="mt-2 text-sm text-green-600">
                Selected: {formData.pdf_file.name}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Reading Material:</strong> Provide reading content for students. You can write rich text directly,
          upload a markdown file for formatted text, or upload a PDF document.
        </p>
      </div>
    </div>
  );
};

export default ReadingForm;