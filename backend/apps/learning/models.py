# learning/models.py (database label: enrollments)
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.core.models import BaseModel
from apps.courses.models import Course, Lecture

class Enrollment(BaseModel):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
        ('refunded', 'Refunded'),
    )
    
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='enrollments')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, 
                              related_name='enrollments')
    
    enrolled_date = models.DateTimeField(default=timezone.now)
    completed_date = models.DateTimeField(null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    progress_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Tracking
    last_accessed = models.DateTimeField(null=True, blank=True)
    total_time_spent = models.IntegerField(default=0)  # in seconds
    
    # Certificate
    certificate_issued = models.BooleanField(default=False)
    certificate_issued_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'enrollments'
        unique_together = ['student', 'course']
        indexes = [
            models.Index(fields=['student', 'status']),
            models.Index(fields=['course', 'status']),
        ]
    
    def __str__(self):
        return f"{self.student.email} - {self.course.title}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        # Auto-create LectureProgress for all lectures when enrollment is created
        if is_new:
            self.create_lecture_progress()

    def create_lecture_progress(self):
        """Create LectureProgress records for all lectures in the course"""
        lectures = Lecture.objects.filter(section__course=self.course)

        lecture_progress_list = []
        for lecture in lectures:
            progress, created = LectureProgress.objects.get_or_create(
                enrollment=self,
                lecture=lecture,
                defaults={
                    'is_completed': False,
                    'progress_seconds': 0,
                    'last_watched_position': 0,
                    'watch_count': 0
                }
            )
            if created:
                lecture_progress_list.append(progress)

        return lecture_progress_list

class LectureProgress(BaseModel):
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE,
                                  related_name='lecture_progress')
    lecture = models.ForeignKey(Lecture, on_delete=models.CASCADE)
    
    is_completed = models.BooleanField(default=False)
    progress_seconds = models.IntegerField(default=0)  # For video lectures
    completed_date = models.DateTimeField(null=True, blank=True)
    
    # Video specific
    last_watched_position = models.IntegerField(default=0)  # in seconds
    watch_count = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'lecture_progress'
        unique_together = ['enrollment', 'lecture']

class CourseBookmark(BaseModel):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='bookmarks')
    course = models.ForeignKey(Course, on_delete=models.CASCADE,
                              related_name='bookmarks')
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'course_bookmarks'
        unique_together = ['student', 'course']

class LearningStreak(BaseModel):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='learning_streaks')
    streak_date = models.DateField(unique=True)
    minutes_learned = models.IntegerField(default=0)
    courses_accessed = models.ManyToManyField(Course)
    
    class Meta:
        db_table = 'learning_streaks'
        unique_together = ['student', 'streak_date']
        ordering = ['-streak_date']
