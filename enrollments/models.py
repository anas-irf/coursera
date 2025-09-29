# enrollments/models.py
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
from core.models import BaseModel
from courses.models import Course, Lecture, Section

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
    expiry_date = models.DateTimeField(null=True, blank=True)
    
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

    def clean(self):
        """Validate enrollment rules"""
        # Check for duplicate active enrollment
        if Enrollment.objects.filter(
            student=self.student,
            course=self.course,
            status__in=['active', 'completed']
        ).exclude(pk=self.pk).exists():
            raise ValidationError("Student is already enrolled in this course")

        # Check subscription access for Plus courses
        if self.course.course_type == 'coursera_plus':
            if not self.student.has_plus_access:
                raise ValidationError("Active Plus subscription required to enroll in this course")

    def save(self, *args, **kwargs):
        self.full_clean()  # This calls clean() method
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

    def calculate_progress(self):
        """Calculate simple progress: completed lectures / total lectures * 100"""
        # Get all lectures in the course
        total_lectures = Lecture.objects.filter(section__course=self.course).count()

        if total_lectures == 0:
            return 0

        # Get completed lectures for this enrollment
        completed_lectures = self.lecture_progress.filter(is_completed=True).count()

        # Calculate percentage
        progress = (completed_lectures / total_lectures) * 100

        # Update enrollment progress - ensure exactly 2 decimal places and within field limits
        from decimal import Decimal, ROUND_HALF_UP

        # Ensure progress doesn't exceed 100
        progress = min(progress, 100.0)

        # Convert to decimal with exactly 2 decimal places
        decimal_progress = Decimal(str(progress)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Ensure the decimal doesn't exceed max_digits (5 total digits, 2 decimal places = max 999.99)
        if decimal_progress > Decimal('999.99'):
            decimal_progress = Decimal('100.00')

        self.progress_percentage = decimal_progress

        try:
            self.save(update_fields=['progress_percentage'])
        except Exception as e:
            raise

        # Check if course should be marked complete
        if progress >= 100 and self.status == 'active':
            self.status = 'completed'
            self.completed_date = timezone.now()
            self.save(update_fields=['status', 'completed_date'])

        return progress

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
    
    def mark_completed(self):
        self.is_completed = True
        self.completed_date = timezone.now()
        self.save()

        # Auto-update enrollment progress
        self.enrollment.calculate_progress()

class CourseBookmark(BaseModel):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='bookmarks')
    course = models.ForeignKey(Course, on_delete=models.CASCADE,
                              related_name='bookmarks')
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'course_bookmarks'
        unique_together = ['student', 'course']

class LectureNote(BaseModel):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='lecture_notes')
    lecture = models.ForeignKey(Lecture, on_delete=models.CASCADE,
                               related_name='notes')
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE)
    
    note_content = models.TextField()
    timestamp = models.IntegerField(null=True, blank=True)  # Video timestamp in seconds
    
    class Meta:
        db_table = 'lecture_notes'
        ordering = ['-created_at']

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