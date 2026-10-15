"""A notification a user receives."""

from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class Notification(BaseModel):
    """Something a user is told: a type, a text and optionally where to go."""
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
    
    # Action URL
    action_url = models.URLField(blank=True, null=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['notification_type']),
        ]
