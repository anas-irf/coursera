# content/models.py
from django.db import models
from apps.core.models import BaseModel
from apps.courses.models import Lecture

class VideoContent(BaseModel):
    lecture = models.OneToOneField(Lecture, on_delete=models.CASCADE,
                                  related_name='video_content')

    # Video files
    video_file = models.FileField(upload_to='lectures/videos/', blank=True, null=True)
    video_url = models.URLField(blank=True, help_text="For external videos (YouTube, Vimeo, etc.)")

    # Video metadata
    duration = models.IntegerField(default=0, help_text="Video duration in seconds")
    resolution = models.CharField(max_length=20, blank=True)
    file_size = models.BigIntegerField(default=0, help_text="File size in bytes")

    # Encoding status
    is_processed = models.BooleanField(default=False)
    processing_progress = models.IntegerField(default=0)

    # Streaming
    hls_playlist = models.FileField(upload_to='videos/hls/', blank=True, null=True)
    dash_manifest = models.FileField(upload_to='videos/dash/', blank=True, null=True)

    class Meta:
        db_table = 'video_content'

    def __str__(self):
        return f"Video for {self.lecture.title}"

class VideoQuality(BaseModel):
    video = models.ForeignKey(VideoContent, on_delete=models.CASCADE,
                             related_name='qualities')
    quality = models.CharField(max_length=10)  # e.g., '1080p', '720p', '480p'
    file = models.FileField(upload_to='videos/qualities/')
    bitrate = models.IntegerField()  # in kbps
    file_size = models.BigIntegerField()  # in bytes
    
    class Meta:
        db_table = 'video_qualities'
        unique_together = ['video', 'quality']

class Subtitle(BaseModel):
    LANGUAGE_CHOICES = (
        ('en', 'English'),
        ('es', 'Spanish'),
        ('fr', 'French'),
        ('de', 'German'),
        ('zh', 'Chinese'),
        ('hi', 'Hindi'),
        ('ar', 'Arabic'),
    )
    
    video = models.ForeignKey(VideoContent, on_delete=models.CASCADE,
                             related_name='subtitles')
    language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    file = models.FileField(upload_to='lectures/subtitles/')
    is_auto_generated = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'subtitles'
        unique_together = ['video', 'language']


class Reading(BaseModel):
    lecture = models.OneToOneField('courses.Lecture', on_delete=models.CASCADE,
                                  related_name='reading')

    # Rich text content (for typed content)
    content = models.TextField(blank=True, help_text="Rich text content for reading material")

    # File content (for uploaded PDF/Markdown files)
    file = models.FileField(upload_to='lectures/readings/', blank=True, null=True,
                           help_text="PDF or Markdown file for reading material")

    # Reading settings
    is_downloadable = models.BooleanField(default=True)

    class Meta:
        db_table = 'readings'

    def __str__(self):
        return f"Reading for {self.lecture.title}"
