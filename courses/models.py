# courses/models.py
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from core.models import BaseModel, Category, Tag, Language
import uuid
import os

def validate_course_thumbnail(value):
    """Validate that the uploaded file is a valid image"""
    if not value:
        return
    
    # Check file extension
    ext = os.path.splitext(value.name)[1].lower()
    valid_extensions = ['.jpg', '.jpeg', '.png', '.webp']
    if ext not in valid_extensions:
        raise ValidationError(
            f'Invalid file extension {ext}. Allowed extensions are: {", ".join(valid_extensions)}'
        )
    
    # Check file size (5MB max)
    if value.size > 5 * 1024 * 1024:
        raise ValidationError('File size cannot exceed 5MB.')
    
    # Check if it's actually an image by trying to read it
    try:
        from PIL import Image
        image = Image.open(value)
        image.verify()
    except Exception:
        raise ValidationError('Invalid image file. Please upload a valid image.')

class Course(BaseModel):
    LEVEL_CHOICES = (
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
        ('all_levels', 'All Levels'),
    )
    
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('published', 'Published'),
        ('unpublished', 'Unpublished'),
        ('rejected', 'Rejected'),
    )
    
    COURSE_TYPE_CHOICES = (
        ('free', 'Free Course'),
        ('coursera_plus', 'Coursera Plus'),
    )

    
    # Basic Information
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    subtitle = models.CharField(max_length=200, blank=True)
    description = models.TextField()
    
    # Instructor
    instructor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                  related_name='courses_created')
    co_instructors = models.ManyToManyField(settings.AUTH_USER_MODEL, 
                                           related_name='courses_co_instructed', blank=True)
    
    course_type = models.CharField(max_length=20, choices=COURSE_TYPE_CHOICES, 
                                  default='coursera_plus')

    
    # Categorization
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, 
                                null=True, related_name='courses')
    subcategory = models.ForeignKey(Category, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name='subcategory_courses')
    tags = models.ManyToManyField(Tag, related_name='courses', blank=True)
    
    # Course Details
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='all_levels')
    language = models.ForeignKey(Language, on_delete=models.SET_NULL, null=True)
    duration_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Media
    thumbnail = models.ImageField(
        upload_to='course_thumbnails/', 
        validators=[validate_course_thumbnail],
        help_text="Course thumbnail image (JPEG, JPG, PNG, WebP - Max 5MB)"
    )
    preview_video = models.FileField(upload_to='course_previews/', blank=True, null=True)
    
    
    # Requirements & Outcomes
    requirements = models.JSONField(default=list, blank=True)  # List of requirements
    what_you_learn = models.JSONField(default=list, blank=True)  # List of learning outcomes
    who_is_for = models.TextField(blank=True)
    
    estimated_hours = models.DecimalField(max_digits=5, decimal_places=1, default=0,
                                         help_text="Estimated hours to complete")

    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    is_featured = models.BooleanField(default=False)

    # Rejection handling
    rejection_reason = models.TextField(blank=True, null=True, help_text="Admin's reason for rejection")
    rejection_date = models.DateTimeField(blank=True, null=True)
    rejected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name='rejected_courses')
    
    # Statistics
    total_enrolled = models.IntegerField(default=0)
    total_reviews = models.IntegerField(default=0)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00,
                                        validators=[MinValueValidator(0), MaxValueValidator(5)])
    
    # Dates
    published_date = models.DateTimeField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)
    
    # SEO
    meta_description = models.CharField(max_length=160, blank=True)
    meta_keywords = models.CharField(max_length=255, blank=True)
    
    class Meta:
        db_table = 'courses'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['status']),
            models.Index(fields=['instructor']),
            models.Index(fields=['-average_rating']),
        ]
    
    def __str__(self):
        return self.title
    

class CoursePrerequisite(BaseModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='prerequisites')
    prerequisite_course = models.ForeignKey(Course, on_delete=models.CASCADE,
                                           related_name='required_for')
    is_mandatory = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'course_prerequisites'
        unique_together = ['course', 'prerequisite_course']

class Section(BaseModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='sections')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)
    is_preview = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'sections'
        ordering = ['order']
        unique_together = ['course', 'order']
    
    def __str__(self):
        return f"{self.course.title} - {self.title}"

class Lecture(BaseModel):
    CONTENT_TYPE_CHOICES = (
        ('video', 'Video'),
        ('reading', 'Reading'),
        ('quiz', 'Quiz'),
        ('assignment', 'Assignment'),
    )
    
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='lectures')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES)
    order = models.IntegerField(default=0)
    
    # Content will be handled by specific content models (VideoContent, Reading, Quiz, Assignment)
    
    # Settings
    is_preview = models.BooleanField(default=False)
    is_downloadable = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'lectures'
        ordering = ['order']
        unique_together = ['section', 'order']
    
    def __str__(self):
        return self.title

class LectureResource(BaseModel):
    lecture = models.ForeignKey(Lecture, on_delete=models.CASCADE, related_name='resources')
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='lectures/resources/')
    is_downloadable = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'lecture_resources'

class CourseAnnouncement(BaseModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='announcements')
    title = models.CharField(max_length=200)
    content = models.TextField()
    is_pinned = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'course_announcements'
        ordering = ['-is_pinned', '-created_at']