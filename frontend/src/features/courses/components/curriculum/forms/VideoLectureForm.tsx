import React, { useState, useEffect } from 'react';
import { Captions, Link2, Loader2, Upload, Video } from 'lucide-react';

import { Button } from '../../../../../shared/ui/Button';
import { Callout } from '../../../../../shared/ui/Callout';
import { useConfirm } from '../../../../../shared/ui/ConfirmDialog';
import { Field } from '../../../../../shared/ui/Field';
import { Input } from '../../../../../shared/ui/Input';
import { SegmentedControl } from '../../../../../shared/ui/SegmentedControl';
import { useToast } from '../../../../../shared/ui/Toast';
import type { LectureFormData } from '../../../types';
import FileDrop from '../../../../../shared/ui/FileDrop';

interface VideoLectureFormProps {
  formData: LectureFormData;
  setFormData: (formData: LectureFormData) => void;
  /** Whether the dialog is sending the lecture. */
  isUploading: boolean;
  /** Lets the user give up an upload in progress. */
  setIsUploading?: (isUploading: boolean) => void;
}

/** A video is a link (YouTube or another host) or a file of the instructor's. */
type VideoSource = 'url' | 'upload';

const MB = 1024 * 1024;

const VideoLectureForm = ({ formData, setFormData, isUploading, setIsUploading }: VideoLectureFormProps) => {
  const { error } = useToast();
  const { confirmWarning } = useConfirm();
  const [videoSource, setVideoSource] = useState<VideoSource>('url');

  // Initialize video source based on existing data
  useEffect(() => {
    if (formData.existing_video_name || formData.video_file) {
      setVideoSource('upload');
    } else if (formData.video_url) {
      setVideoSource('url');
    }
  }, [formData.existing_video_name, formData.video_file, formData.video_url]);

  const handleVideoSourceChange = (source: VideoSource) => {
    setVideoSource(source);
    // Clear subtitle file when switching to URL mode
    if (source === 'url') {
      setFormData({ ...formData, subtitle_file: null });
    }
  };

  const handleFile = async (file: File, reset: () => void) => {
    // Check file size and warn for large files
    const fileSizeMB = file.size / MB;
    const fileGB = fileSizeMB / 1024;

    if (fileSizeMB > 2048) { // 2GB limit
      error(`This file is ${fileGB.toFixed(2)}GB which exceeds the 2GB limit. Please:\n\n` +
            `• Compress the video to reduce file size\n` +
            `• Use YouTube and paste the video URL instead\n` +
            `• Split long videos into shorter segments\n\n` +
            `Maximum file size allowed is 2GB.`, 'File Too Large');
      reset();
      return;
    } else if (fileSizeMB > 1024) { // 1GB+ warning
      const confirmed = await confirmWarning(
        `This file is ${fileGB.toFixed(2)}GB. Very large files may take 10+ minutes to upload and could timeout.`,
        'Large File Warning'
      );
      if (!confirmed) {
        reset();
        return;
      }
    } else if (fileSizeMB > 500) { // 500MB+ warning
      const confirmed = await confirmWarning(
        `This file is ${fileSizeMB.toFixed(1)}MB. Large files may take several minutes to upload.`,
        'Large File Warning'
      );
      if (!confirmed) {
        reset();
        return;
      }
    }

    // the server reads the length of the file when it is saved
    setFormData({ ...formData, video_file: file, video_url: '' });
  };

  const handleCancelUpload = async () => {
    const confirmed = await confirmWarning(
      'You will lose any upload progress.',
      'Cancel Upload'
    );
    if (confirmed) {
      if (setIsUploading) setIsUploading(false);
      setFormData({ ...formData, video_file: null });
    }
  };

  // the file just chosen: ``video_file`` holds the url of the stored video until one is
  const chosenVideo = typeof formData.video_file === 'string' ? null : formData.video_file;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-fg">Video source</p>
        <SegmentedControl
          label="Video source"
          value={videoSource}
          onChange={handleVideoSourceChange}
          options={[
            { value: 'url', label: 'YouTube or link', icon: Link2 },
            { value: 'upload', label: 'Upload a file', icon: Upload },
          ]}
        />
      </div>

      {videoSource === 'url' ? (
        <>
          <Field label="Video URL" hint="YouTube, Vimeo or a direct link to a video file.">
            <Input
              type="url"
              icon={Link2}
              value={formData.video_url}
              onChange={(e) => setFormData({ ...formData, video_url: e.target.value, video_file: null })}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </Field>
          <Callout tone="info">
            Subtitles of a YouTube video are managed on YouTube: add closed captions in the video's settings there.
          </Callout>
        </>
      ) : (
        <>
          <Field label="Video file">
            <FileDrop
              accept="video/*"
              icon={Video}
              title={formData.existing_video_name ? 'Drop a new video to replace the current one' : 'Drop a video here'}
              hint="MP4, WebM or MOV up to 2 GB. Files over 1 GB can take 10 minutes or more."
              buttonLabel="Choose video"
              file={chosenVideo}
              onRemove={() => setFormData({ ...formData, video_file: null })}
              current={formData.existing_video_name ? { name: formData.existing_video_name } : null}
              disabled={isUploading}
              onFile={handleFile}
              busy={
                isUploading ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft/40 px-6 py-7 text-center">
                    <Loader2 size={28} aria-hidden="true" className="animate-spin text-primary-fg" />
                    <div>
                      <p className="text-sm font-medium text-fg">Uploading video...</p>
                      <p className="text-xs text-fg-subtle">Please keep this dialog open until it is done.</p>
                    </div>
                    <Button variant="danger-soft" size="sm" onClick={handleCancelUpload}>
                      Cancel Upload
                    </Button>
                  </div>
                ) : null
              }
            />
          </Field>

          <Field label="Subtitles (optional)" hint="A WebVTT (.vtt) or SubRip (.srt) file.">
            <FileDrop
              accept=".vtt,.srt"
              icon={Captions}
              title={formData.existing_subtitle_name ? 'Drop a new subtitle file to replace it' : 'Drop a subtitle file here'}
              buttonLabel={formData.existing_subtitle_name ? 'Replace Subtitle File' : 'Choose Subtitle File'}
              file={formData.subtitle_file}
              onRemove={() => setFormData({ ...formData, subtitle_file: null })}
              current={formData.existing_subtitle_name ? { name: formData.existing_subtitle_name } : null}
              onFile={(file) => setFormData({ ...formData, subtitle_file: file })}
            />
          </Field>
        </>
      )}
    </div>
  );
};

export default VideoLectureForm;
