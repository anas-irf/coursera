# analytics/models.py
from django.db import models
from django.conf import settings
from core.models import BaseModel
from courses.models import Course, Lecture

class CourseAnalytics(BaseModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE,
                              related_name='analytics')
    date = models.DateField()
    
    # Enrollment metrics
    new_enrollments = models.IntegerField(default=0)
    total_enrollments = models.IntegerField(default=0)
    active_students = models.IntegerField(default=0)
    
    # Engagement metrics
    avg_progress = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    completion_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    avg_time_spent = models.IntegerField(default=0)  # in minutes
    
    # Revenue metrics
    revenue_today = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    revenue_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    class Meta:
        db_table = 'course_analytics'
        unique_together = ['course', 'date']
        ordering = ['-date']

class StudentAnalytics(BaseModel):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='analytics')
    date = models.DateField()
    
    # Learning metrics
    minutes_learned = models.IntegerField(default=0)
    lectures_completed = models.IntegerField(default=0)
    quizzes_attempted = models.IntegerField(default=0)
    assignments_submitted = models.IntegerField(default=0)
    
    # Progress metrics
    courses_active = models.IntegerField(default=0)
    courses_completed = models.IntegerField(default=0)
    certificates_earned = models.IntegerField(default=0)
    
    # Engagement score (calculated)
    engagement_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    class Meta:
        db_table = 'student_analytics'
        unique_together = ['student', 'date']
        ordering = ['-date']

class LectureAnalytics(BaseModel):
    lecture = models.ForeignKey(Lecture, on_delete=models.CASCADE,
                               related_name='analytics')
    date = models.DateField()
    
    views = models.IntegerField(default=0)
    unique_views = models.IntegerField(default=0)
    completions = models.IntegerField(default=0)
    avg_watch_time = models.IntegerField(default=0)  # in seconds
    drop_off_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    class Meta:
        db_table = 'lecture_analytics'
        unique_together = ['lecture', 'date']

class PlatformAnalytics(BaseModel):
    date = models.DateField(unique=True)
    
    # User metrics
    total_users = models.IntegerField(default=0)
    new_users = models.IntegerField(default=0)
    active_users = models.IntegerField(default=0)
    
    # Course metrics  
    total_courses = models.IntegerField(default=0)
    published_courses = models.IntegerField(default=0)
    
    # Enrollment metrics
    new_enrollments = models.IntegerField(default=0)
    total_enrollments = models.IntegerField(default=0)
    
    # Revenue metrics
    daily_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    monthly_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Engagement metrics
    avg_session_duration = models.IntegerField(default=0)  # in minutes
    
    class Meta:
        db_table = 'platform_analytics'
        ordering = ['-date']