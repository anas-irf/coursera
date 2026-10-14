import React, { useState, useEffect } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useToast } from '../../../../../shared/ui/Toast';
import { useConfirm } from '../../../../../shared/ui/ConfirmDialog';

const VideoLectureForm = ({ formData, setFormData, isUploading, setIsUploading }) => {
  const { error } = useToast();
  const { confirmWarning } = useConfirm();
  const [videoSource, setVideoSource] = useState('url');

  // Initialize video source based on existing data
  useEffect(() => {
    if (formData.existing_video_name || formData.video_file) {
      setVideoSource('upload');
    } else if (formData.video_url) {
      setVideoSource('url');
    }
  }, [formData.existing_video_name, formData.video_file, formData.video_url]);

  const handleVideoSourceChange = (source) => {
    setVideoSource(source);
    // Clear subtitle file when switching to URL mode
    if (source === 'url') {
      setFormData({ ...formData, subtitle_file: null });
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size and warn for large files
      const fileSizeMB = file.size / (1024 * 1024);
      const fileGB = fileSizeMB / 1024;

      if (fileSizeMB > 2048) { // 2GB limit
        error(`This file is ${fileGB.toFixed(2)}GB which exceeds the 2GB limit. Please:\n\n` +
              `• Compress the video to reduce file size\n` +
              `• Use YouTube and paste the video URL instead\n` +
              `• Split long videos into shorter segments\n\n` +
              `Maximum file size allowed is 2GB.`, 'File Too Large');
        e.target.value = ''; // Clear the input
        return;
      } else if (fileSizeMB > 1024) { // 1GB+ warning
        const confirmed = await confirmWarning(
          `This file is ${fileGB.toFixed(2)}GB. Very large files may take 10+ minutes to upload and could timeout.`,
          'Large File Warning'
        );
        if (!confirmed) {
          e.target.value = ''; // Clear the input
          return;
        }
      } else if (fileSizeMB > 500) { // 500MB+ warning
        const confirmed = await confirmWarning(
          `This file is ${fileSizeMB.toFixed(1)}MB. Large files may take several minutes to upload.`,
          'Large File Warning'
        );
        if (!confirmed) {
          e.target.value = ''; // Clear the input
          return;
        }
      }

      setFormData({ ...formData, video_file: file, video_url: '' });
    }
  };

  const handleSubtitleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, subtitle_file: file });
    }
  };

  const handleCancelUpload = async () => {
    const confirmed = await confirmWarning(
      'You will lose any upload progress.',
      'Cancel Upload'
    );
    if (confirmed) {
      setIsUploading && setIsUploading(false);
      setFormData({ ...formData, video_file: null });
      // Reset the file input
      const fileInput = document.getElementById('video-upload');
      if (fileInput) {
        fileInput.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Video Source
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="url"
              checked={videoSource === 'url'}
              onChange={(e) => handleVideoSourceChange(e.target.value)}
              className="text-indigo-600"
            />
            <span className="text-sm">YouTube/External URL</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="upload"
              checked={videoSource === 'upload'}
              onChange={(e) => handleVideoSourceChange(e.target.value)}
              className="text-indigo-600"
            />
            <span className="text-sm">Upload Video File</span>
          </label>
        </div>
      </div>

      {/* Show existing video info if editing */}
      {formData.existing_video_name && videoSource === 'upload' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Current Video</h4>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v16a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h4z" />
            </svg>
            <span className="text-sm text-blue-700">{formData.existing_video_name}</span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Upload a new video file to replace the current one
          </p>
        </div>
      )}

      {videoSource === 'url' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video URL
          </label>
          <input
            type="url"
            value={formData.video_url}
            onChange={(e) => setFormData({...formData, video_url: e.target.value, video_file: null})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Supported: YouTube, Vimeo, and direct video URLs
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Video File
          </label>
          <div className={`border-2 border-dashed rounded-lg p-6 text-center ${
            isUploading ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300'
          }`}>
            {isUploading ? (
              <Loader2 className="mx-auto h-12 w-12 text-indigo-600 mb-4 animate-spin" />
            ) : (
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            )}

            {isUploading ? (
              <div>
                <p className="text-indigo-600 mb-2 font-medium">Uploading video...</p>
                <p className="text-sm text-indigo-500">Please wait while your video is being uploaded</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">Choose video file or drag and drop</p>
                <p className="text-sm text-gray-500">MP4, WebM, MOV up to 2GB</p>
                <p className="text-xs text-gray-400 mt-1">⚠️ Large files (1GB+) may take 10+ minutes to upload</p>
              </div>
            )}

            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              id="video-upload"
              disabled={isUploading}
            />
            <div className="mt-3 flex gap-2 justify-center">
              <label
                htmlFor="video-upload"
                className={`inline-flex items-center px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  isUploading
                    ? 'border-gray-300 text-gray-400 bg-gray-100 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 cursor-pointer'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Choose File'
                )}
              </label>

              {isUploading && (
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="inline-flex items-center px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 transition-colors"
                >
                  Cancel Upload
                </button>
              )}
            </div>
          </div>
          {formData.video_file && !isUploading && (
            <div className="mt-4">
              <p className="text-sm text-green-600">
                Selected: {formData.video_file.name}
                {formData.video_file.size && (
                  <span className="text-gray-500 ml-2">
                    ({(formData.video_file.size / (1024 * 1024)).toFixed(1)}MB)
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Subtitle Upload Section - Only show for uploaded videos */}
      {videoSource === 'upload' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subtitles (Optional)
          </label>

          {/* Show existing subtitle info if editing */}
          {formData.existing_subtitle_name && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
              <h5 className="text-sm font-medium text-green-800 mb-1">Current Subtitle</h5>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-green-700">{formData.existing_subtitle_name}</span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                Upload a new subtitle file to replace the current one
              </p>
            </div>
          )}

          <div className="border border-gray-300 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".vtt,.srt"
                onChange={handleSubtitleChange}
                className="hidden"
                id="subtitle-upload"
              />
              <label
                htmlFor="subtitle-upload"
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
              >
                {formData.existing_subtitle_name ? 'Replace Subtitle File' : 'Choose Subtitle File'}
              </label>
              <span className="text-sm text-gray-500">
                VTT or SRT format
              </span>
            </div>
            {formData.subtitle_file && (
              <div className="mt-2">
                <p className="text-sm text-green-600">
                  New file selected: {formData.subtitle_file.name}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* YouTube subtitle note */}
      {videoSource === 'url' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> For YouTube videos, subtitles are managed directly on YouTube.
            You can add closed captions in your YouTube video settings.
          </p>
        </div>
      )}
    </div>
  );
};

export default VideoLectureForm;