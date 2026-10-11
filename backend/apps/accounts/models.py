# accounts/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.utils import timezone
import uuid
from django.conf import settings
from apps.core.models import BaseModel

class User(AbstractUser):
    USER_TYPE_CHOICES = (
        ('student', 'Student'),
        ('instructor', 'Instructor'),
        ('admin', 'Admin'),
    )
    
    # id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)

    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default='student')
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True,
        validators=[RegexValidator(regex=r'^\+?1?\d{9,15}$')])
    
    # Profile fields
    bio = models.TextField(max_length=500, blank=True)
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    country = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    
    # Additional fields
    email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login_ip = models.GenericIPAddressField(blank=True, null=True)
    
    # Social auth
    google_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    
    # Two-factor auth
    two_factor_enabled = models.BooleanField(default=False)
    two_factor_secret = models.CharField(max_length=255, blank=True, null=True)
    
    # Instructor specific
    expertise = models.TextField(blank=True)
    linkedin_url = models.URLField(blank=True, null=True)
    website_url = models.URLField(blank=True, null=True)
    years_of_experience = models.IntegerField(default=0)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['user_type']),
        ]

    def __str__(self):
        return f"{self.email} - {self.user_type}"
    
    @property
    def is_student(self):
        return self.user_type == 'student'
    
    @property
    def is_instructor(self):
        return self.user_type == 'instructor'
    
    @property
    def is_admin(self):
        return self.user_type == 'admin' or self.is_superuser


class InstructorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='instructor_profile')
    verified_instructor = models.BooleanField(default=False)
    total_students = models.IntegerField(default=0)
    total_reviews = models.IntegerField(default=0)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    earnings_total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    earnings_pending = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    payout_method = models.CharField(max_length=50, blank=True)
    payout_email = models.EmailField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'instructor_profiles'

class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    learning_goals = models.TextField(blank=True)
    interests = models.JSONField(default=list, blank=True)
    preferred_language = models.CharField(max_length=10, default='en')
    learning_streak = models.IntegerField(default=0)
    last_learning_date = models.DateField(null=True, blank=True)
    total_learning_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'student_profiles'
        
