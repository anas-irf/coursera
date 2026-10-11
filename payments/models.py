# payments/models.py
from django.db import models
from django.conf import settings
from core.models import BaseModel
from courses.models import Course
from decimal import Decimal

class SubscriptionPlan(BaseModel):
    """Coursera Plus subscription plans"""
    BILLING_CYCLE_CHOICES = (
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
    )
    
    name = models.CharField(max_length=100)  # e.g., "Coursera Plus Monthly"
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    billing_cycle = models.CharField(max_length=20, choices=BILLING_CYCLE_CHOICES)
    
    # Features
    unlimited_courses = models.BooleanField(default=True)
    certificate_included = models.BooleanField(default=True)
    download_enabled = models.BooleanField(default=True)
    
    # Stripe
    stripe_price_id = models.CharField(max_length=255, blank=True)
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'subscription_plans'

class InstructorEarning(BaseModel):
    """
    Earnings based on Coursera model:
    - Revenue share from subscriptions based on engagement
    - Calculated monthly based on:
      1. Number of enrollments
      2. Course completion rate
      3. Total watch time
      4. Student engagement
    """
    EARNING_TYPE_CHOICES = (
        ('monthly_share', 'Monthly Revenue Share'),
        ('bonus', 'Performance Bonus'),
        ('special', 'Special Program'),
    )
    
    instructor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                  related_name='earnings')
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    
    earning_type = models.CharField(max_length=20, choices=EARNING_TYPE_CHOICES,
                                   default='monthly_share')
    
    # Metrics used for calculation
    month = models.DateField()  # Which month this earning is for
    enrollments_count = models.IntegerField(default=0)
    completions_count = models.IntegerField(default=0)
    total_watch_minutes = models.IntegerField(default=0)
    engagement_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Calculated earnings
    base_amount = models.DecimalField(max_digits=10, decimal_places=2)
    performance_multiplier = models.DecimalField(max_digits=3, decimal_places=2, default=1.0)
    final_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Payment status
    is_paid = models.BooleanField(default=False)
    payout_date = models.DateTimeField(null=True, blank=True)
    payout_reference = models.CharField(max_length=255, blank=True)
    
    class Meta:
        db_table = 'instructor_earnings'
        unique_together = ['instructor', 'course', 'month']

class CourseraRevenuePool(BaseModel):
    """
    Monthly revenue pool to be distributed among instructors
    Based on Coursera Plus subscriptions
    """
    month = models.DateField(unique=True)
    total_subscription_revenue = models.DecimalField(max_digits=12, decimal_places=2)
    
    # After Coursera's platform fee (usually 50-70%)
    instructor_pool = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Metrics for distribution
    total_enrollments = models.IntegerField(default=0)
    total_watch_minutes = models.BigIntegerField(default=0)
    
    is_distributed = models.BooleanField(default=False)
    distributed_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'revenue_pools'