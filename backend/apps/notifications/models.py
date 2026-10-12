# notifications/models.py
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class Notification(BaseModel):
    NOTIFICATION_TYPE_CHOICES = (
        # Course management
        ('course_rejected', 'Course Rejected'),
        ('course_approved', 'Course Approved'),
        ('course_published', 'Course Published'),
        ('course_submission', 'Course Submitted for Review'),

        # Student interactions
        ('enrollment', 'New Enrollment'),
        ('course_update', 'Course Update'),
        ('assignment_due', 'Assignment Due'),
        ('assignment_graded', 'Assignment Graded'),
        ('quiz_available', 'Quiz Available'),
        ('certificate_earned', 'Certificate Earned'),

        # Payments
        ('payment_success', 'Payment Success'),
        ('payment_failed', 'Payment Failed'),

        # Communication
        ('announcement', 'Announcement'),
        ('message', 'Direct Message'),
        ('review', 'New Review'),

        # System
        ('system', 'System Notification'),
    )
    
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                 related_name='notifications')
    
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    
    # Link to related object
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, 
                                    null=True, blank=True)
    object_id = models.CharField(max_length=255, null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Email
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Action URL
    action_url = models.URLField(blank=True, null=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['notification_type']),
        ]

class NotificationPreference(BaseModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='notification_preferences')
    
    # Email notifications
    email_enrollment = models.BooleanField(default=True)
    email_course_updates = models.BooleanField(default=True)
    email_assignments = models.BooleanField(default=True)
    email_announcements = models.BooleanField(default=True)
    email_discussions = models.BooleanField(default=False)
    email_messages = models.BooleanField(default=True)
    email_marketing = models.BooleanField(default=False)
    
    # In-app notifications
    app_enrollment = models.BooleanField(default=True)
    app_course_updates = models.BooleanField(default=True)
    app_assignments = models.BooleanField(default=True)
    app_announcements = models.BooleanField(default=True)
    app_discussions = models.BooleanField(default=True)
    app_messages = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'notification_preferences'

class EmailTemplate(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    subject = models.CharField(max_length=200)
    html_content = models.TextField()
    text_content = models.TextField(blank=True)
    
    # Variables that can be used in template
    available_variables = models.JSONField(default=list)
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'email_templates'