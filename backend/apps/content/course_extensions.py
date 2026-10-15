"""Video and reading lectures: how their content is authored and presented."""
import os

from apps.core.api.errors import ServiceError
from apps.core.utils import sanitize_html
from apps.courses.extensions import LectureContentHandler, register_content_handler

from .media import video_seconds
from .models import Reading, Subtitle, VideoContent

READING_EXTENSIONS = ('.pdf', '.md', '.markdown')
MAX_VIDEO_SECONDS = 24 * 3600


def _duration(data):
    """The length in seconds a client says the video has, or ``None`` when it sent none.

    It is only a fallback: the length of an uploaded file is read from the file
    (``media.video_seconds``).  What a client sent is still validated.
    """
    raw = data.get('duration')
    if raw in (None, ''):
        return None
    try:
        seconds = round(float(raw))
    except (TypeError, ValueError, OverflowError):
        raise ServiceError('duration must be a number of seconds') from None
    if not 0 <= seconds <= MAX_VIDEO_SECONDS:
        raise ServiceError('duration must be between 0 and 24 hours')
    return seconds


def _length(video_file, data):
    """Seconds of a video being saved: read from the uploaded file, else what the client said."""
    claimed = _duration(data)  # validates what was sent even when the file is measured instead
    measured = video_seconds(video_file) if video_file else None
    return measured if measured is not None else claimed


def _file_name(file_field):
    return os.path.basename(file_field.name) if file_field else None


class VideoHandler(LectureContentHandler):
    """The video lecture: an uploaded file with subtitles or a YouTube link."""
    content_type = 'video'

    def create(self, lecture, data, files):
        """Create video content and subtitles for video lectures"""
        video_file = files.get('video_file')
        video_url = data.get('video_url', '')
        seconds = _length(video_file, data)

        # Only create VideoContent if we have video_file or video_url
        if video_file or video_url:
            video_content = VideoContent.objects.create(
                lecture=lecture,
                video_file=video_file,
                video_url=video_url,
                duration=seconds or 0,
            )

            # Handle subtitle file if provided
            subtitle_file = files.get('subtitle_file')
            if subtitle_file:
                # Default to English for now, could be made configurable
                Subtitle.objects.create(
                    video=video_content,
                    language='en',
                    file=subtitle_file,
                    is_auto_generated=False
                )

    def update(self, lecture, data, files):
        """Update video content for video lectures"""
        # Get existing video content if it exists
        try:
            video_content = VideoContent.objects.get(lecture=lecture)
        except VideoContent.DoesNotExist:
            video_content = None

        # Get video data
        video_file = files.get('video_file')
        video_url = data.get('video_url', '')
        seconds = _length(video_file, data)

        # Only update/create if we have video data
        if video_file or video_url:
            if video_content:
                # Update existing video content
                if video_file:
                    video_content.video_file = video_file
                    # a new file replaces the old length, known or not
                    video_content.duration = seconds or 0
                elif seconds is not None:
                    video_content.duration = seconds
                video_content.video_url = video_url
                video_content.save()
            else:
                # Create new video content
                video_content = VideoContent.objects.create(
                    lecture=lecture,
                    video_file=video_file,
                    video_url=video_url,
                    duration=seconds or 0,
                )

            # Handle subtitle file if provided
            subtitle_file = files.get('subtitle_file')
            if subtitle_file:
                # Remove existing subtitle and create new one
                Subtitle.objects.filter(video=video_content, language='en').delete()
                Subtitle.objects.create(
                    video=video_content,
                    language='en',
                    file=subtitle_file,
                    is_auto_generated=False
                )

    # --- instructor view ---------------------------------------------------- #
    def instructor_defaults(self):
        return {
            'video_content': None,
            'subtitle_file': None,
            'existing_video_name': None,
            'existing_subtitle_name': None,
        }

    def serialize_for_instructor(self, lecture):
        try:
            video = VideoContent.objects.get(lecture=lecture)
        except VideoContent.DoesNotExist:
            return {
                'video_content': {
                    'video_url': '',
                    'video_file': None,
                    'duration': 0,
                    'existing_video_name': None,
                },
                'subtitle_file': None,
                'existing_video_name': None,
                'existing_subtitle_name': None,
            }

        subtitle = video.subtitles.first()
        return {
            'video_content': {
                'video_url': video.video_url,
                'video_file': video.video_file.url if video.video_file else None,
                'duration': video.duration,
                'existing_video_name': _file_name(video.video_file),
            },
            'subtitle_file': subtitle.file.url if subtitle and subtitle.file else None,
            'existing_video_name': _file_name(video.video_file),
            'existing_subtitle_name': _file_name(subtitle.file) if subtitle and subtitle.file else None,
        }

    # --- learner view ------------------------------------------------------- #
    def serialize_for_student(self, lecture, student):
        try:
            video_content = VideoContent.objects.get(lecture=lecture)
        except VideoContent.DoesNotExist:
            return {
                'video_type': 'local',
                'video_file_url': None,
                'video_url': None,
                'duration': 0,
                'thumbnail': None,
                'subtitles': [],
            }

        subtitles = [
            {
                'language': subtitle.language,
                'language_name': subtitle.get_language_display(),
                'url': subtitle.file.url if subtitle.file else None,
                'is_auto_generated': subtitle.is_auto_generated,
            }
            for subtitle in video_content.subtitles.all()
        ]
        return {
            'video_type': 'youtube' if video_content.video_url else 'local',
            'video_file_url': video_content.video_file.url if video_content.video_file else None,
            'video_url': video_content.video_url if video_content.video_url else None,
            'duration': video_content.duration,
            'thumbnail': None,  # VideoContent doesn't have thumbnail field yet
            'subtitles': subtitles,
        }

    def duration(self, lecture):
        try:
            return VideoContent.objects.get(lecture=lecture).duration
        except VideoContent.DoesNotExist:
            return 0


class ReadingHandler(LectureContentHandler):
    """The reading lecture: sanitised rich text or an uploaded document."""
    content_type = 'reading'

    @staticmethod
    def _uploaded_file(files):
        """The reading document of the request (any of the accepted field names)."""
        file_to_upload = (files.get('reading_file') or files.get('markdown_file')
                          or files.get('pdf_file'))
        if file_to_upload:
            extension = os.path.splitext(file_to_upload.name)[1].lower()
            if extension not in READING_EXTENSIONS:
                raise ServiceError('Invalid file type. Only PDF and Markdown files are allowed.')
        return file_to_upload

    def create(self, lecture, data, files):
        """Create reading from lecture data"""
        content = sanitize_html(data.get('article_content', ''))
        file_to_upload = self._uploaded_file(files)

        # Create Reading record (either with content or file or both)
        if content or file_to_upload:
            Reading.objects.create(
                lecture=lecture,
                content=content,
                file=file_to_upload,
                is_downloadable=True
            )

    def update(self, lecture, data, files):
        """Update reading for reading lectures"""
        existing_reading = Reading.objects.filter(lecture=lecture).first()

        sent = 'article_content' in data
        content = sanitize_html(data.get('article_content', ''))
        file_to_upload = self._uploaded_file(files)

        if existing_reading:
            # Update existing reading (text that was not sent is left as it is)
            if sent:
                existing_reading.content = content
            if file_to_upload:
                existing_reading.file = file_to_upload
            existing_reading.save()
        else:
            # Create new reading if content or file provided
            if content or file_to_upload:
                Reading.objects.create(
                    lecture=lecture,
                    content=content,
                    file=file_to_upload,
                    is_downloadable=True
                )

    # --- instructor view ---------------------------------------------------- #
    def instructor_defaults(self):
        return {'reading_document': None, 'article_content': ''}

    def serialize_for_instructor(self, lecture):
        try:
            reading = Reading.objects.get(lecture=lecture)
        except Reading.DoesNotExist:
            return {
                'reading_document': {
                    'file': None,
                    'existing_file': None,
                    'file_name': None,
                    'file_type': None,
                    'is_downloadable': True,
                },
                'article_content': '',
            }

        # Determine file type based on extension
        file_type = None
        if reading.file:
            extension = os.path.splitext(reading.file.name)[1].lower()
            if extension == '.pdf':
                file_type = 'pdf_file'
            elif extension in ('.md', '.markdown'):
                file_type = 'markdown_file'

        return {
            'reading_document': {
                'file': reading.file.url if reading.file else None,
                'existing_file': reading.file.url if reading.file else None,
                'file_name': _file_name(reading.file),
                'file_type': file_type,
                'is_downloadable': reading.is_downloadable,
            },
            'article_content': reading.content,
        }

    # --- learner view ------------------------------------------------------- #
    def serialize_for_student(self, lecture, student):
        try:
            reading = Reading.objects.get(lecture=lecture)
        except Reading.DoesNotExist:
            return {
                'content': '',
                'estimated_reading_time': 0,
                'file_url': None,
                'is_downloadable': False,
            }
        return {
            'content': reading.content,
            'estimated_reading_time': 10,  # Default estimated time in minutes
            'file_url': reading.file.url if reading.file else None,
            'is_downloadable': reading.is_downloadable,
        }


def register():
    register_content_handler(VideoHandler())
    register_content_handler(ReadingHandler())
