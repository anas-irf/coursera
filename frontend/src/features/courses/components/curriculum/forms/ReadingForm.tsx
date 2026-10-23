import React, { useState, useEffect } from 'react';
import { FileCode2, FileText, Type } from 'lucide-react';

import { mediaUrl } from '../../../../../shared/lib/media';
import { Callout } from '../../../../../shared/ui/Callout';
import { Field } from '../../../../../shared/ui/Field';
import { Textarea } from '../../../../../shared/ui/Input';
import { SegmentedControl } from '../../../../../shared/ui/SegmentedControl';
import type { LectureFormData } from '../../../types';
import FileDrop from '../../../../../shared/ui/FileDrop';

interface ReadingFormProps {
  formData: LectureFormData;
  setFormData: (formData: LectureFormData) => void;
  /** The document chosen in this dialog (the dialog sends it as its own part of the request). */
  readingFile: File | null;
  setReadingFile: (file: File | null) => void;
}

/** What a reading is made of: text written in the form, or a markdown or a PDF file. */
type ReadingContentType = 'rich_text' | 'markdown_file' | 'pdf_file';

const ReadingForm = ({ formData, setFormData, readingFile, setReadingFile }: ReadingFormProps) => {
  // Determine initial content type based on existing data
  const getInitialContentType = (): ReadingContentType => {
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

  const [contentType, setContentType] = useState<ReadingContentType>(getInitialContentType);

  // Update content type when formData changes (important for editing)
  useEffect(() => {
    setContentType(getInitialContentType());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.reading_document, formData.article_content]);

  const handleContentTypeChange = (type: ReadingContentType) => {
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

  const handleFileUpload = (file: File | null, fileType: 'markdown_file' | 'pdf_file') => {
    if (fileType === 'markdown_file') {
      setFormData({...formData, markdown_file: file});
    } else if (fileType === 'pdf_file') {
      setFormData({...formData, pdf_file: file});
    }
    setReadingFile(file);
  };

  // the stored document of the reading, when it is of the kind being edited
  const stored = (kind: 'markdown_file' | 'pdf_file') => {
    const document = formData.reading_document;
    if (!document || document.file_type !== kind || !document.existing_file) return null;
    return { name: document.file_name || (kind === 'pdf_file' ? 'PDF file' : 'markdown file'), url: mediaUrl(document.existing_file) };
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-fg">Reading content</p>
        <SegmentedControl
          label="Reading content type"
          value={contentType}
          onChange={handleContentTypeChange}
          options={[
            { value: 'rich_text', label: 'Rich Text', icon: Type },
            { value: 'markdown_file', label: 'Markdown File', icon: FileCode2 },
            { value: 'pdf_file', label: 'PDF File', icon: FileText },
          ]}
        />
      </div>

      {contentType === 'rich_text' && (
        <Field label="Reading Content" required hint="Headings, lists and links in markdown are kept.">
          <Textarea
            rows={12}
            value={formData.article_content || ''}
            onChange={(e) => setFormData({...formData, article_content: e.target.value})}
            placeholder="Write the reading here. You can use markdown formatting..."
            className="font-mono"
          />
        </Field>
      )}

      {contentType === 'markdown_file' && (
        <Field label="Markdown File" required hint="Markdown files (.md, .markdown) up to 10 MB.">
          <FileDrop
            accept=".md,.markdown"
            icon={FileCode2}
            title="Drop a markdown file here"
            buttonLabel="Choose Markdown File"
            file={formData.markdown_file}
            onRemove={() => handleFileUpload(null, 'markdown_file')}
            current={stored('markdown_file')}
            onFile={(file) => handleFileUpload(file, 'markdown_file')}
          />
        </Field>
      )}

      {contentType === 'pdf_file' && (
        <Field label="PDF File" required hint="PDF files up to 50 MB.">
          <FileDrop
            accept=".pdf"
            icon={FileText}
            title={stored('pdf_file') ? 'Drop a new PDF to replace the current reading' : 'Drop a PDF here'}
            buttonLabel={stored('pdf_file') ? 'Replace PDF' : 'Choose PDF File'}
            file={formData.pdf_file}
            onRemove={() => handleFileUpload(null, 'pdf_file')}
            current={stored('pdf_file')}
            onFile={(file) => handleFileUpload(file, 'pdf_file')}
          />
        </Field>
      )}

      <Callout tone="neutral">
        Write the reading here, upload a markdown file for formatted text, or upload a PDF document. Readings are
        cleaned of scripts before learners see them.
      </Callout>
    </div>
  );
};

export default ReadingForm;
