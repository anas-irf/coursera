# accounts/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.utils import timezone
import uuid
from django.conf import settings
from core.models import BaseModel

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

    @property
    def has_plus_access(self):
        """Check if user has active Coursera Plus subscription"""
        if self.user_type != 'student':
            return False
        try:
            subscription = StudentPlusSubscription.objects.get(student=self)
            return subscription.can_access_plus_courses()
        except StudentPlusSubscription.DoesNotExist:
            return False

    @property
    def subscription_status(self):
        """Get user's subscription status info"""
        if self.user_type != 'student':
            return None

        try:
            subscription = StudentPlusSubscription.objects.get(student=self)
            return {
                'has_subscription': True,
                'type': subscription.subscription_type,
                'status': subscription.status,
                'is_active': subscription.is_active(),
                'end_date': subscription.end_date,
                'next_billing_date': subscription.next_billing_date
            }
        except StudentPlusSubscription.DoesNotExist:
            return {
                'has_subscription': False,
                'type': None,
                'status': 'none',
                'is_active': False,
                'end_date': None,
                'next_billing_date': None
            }

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
        
class StudentPlusSubscription(BaseModel):
    SUBSCRIPTION_STATUS_CHOICES = (
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
        ('pending', 'Pending Payment'),
    )

    SUBSCRIPTION_TYPE_CHOICES = (
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
        ('lifetime', 'Lifetime'),
    )

    student = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='plus_subscription',
        limit_choices_to={'user_type': 'student'}
    )

    subscription_type = models.CharField(max_length=20, choices=SUBSCRIPTION_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=SUBSCRIPTION_STATUS_CHOICES, default='pending')

    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)

    # Payment tracking
    payment_method = models.CharField(max_length=50, blank=True)
    last_payment_date = models.DateTimeField(null=True, blank=True)
    next_billing_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'student_plus_subscriptions'

    def is_active(self):
        """Check if subscription is currently active"""
        if self.status != 'active':
            return False
        if self.end_date and self.end_date < timezone.now():
            return False
        return True

    def can_access_plus_courses(self):
        """Check if student can access coursera plus courses"""
        return self.is_active()

class StudentPlusPayment(BaseModel):
    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )

    subscription = models.ForeignKey(StudentPlusSubscription, on_delete=models.CASCADE,
                                    related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')

    payment_date = models.DateTimeField(auto_now_add=True)
    payment_method = models.CharField(max_length=50)
    transaction_id = models.CharField(max_length=100, unique=True, null=True, blank=True)

    class Meta:
        db_table = 'student_plus_payments'
        ordering = ['-payment_date']