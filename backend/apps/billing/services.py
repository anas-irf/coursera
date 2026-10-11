# payments/services.py
from decimal import Decimal
from datetime import datetime, timedelta
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from .models import InstructorEarning, CourseraRevenuePool
from apps.learning.models import Enrollment, LectureProgress
from apps.courses.models import Course

class EarningsCalculator:
    """
    Calculate instructor earnings based on Coursera model
    
    Formula:
    - Base share from revenue pool based on enrollment percentage
    - Bonus for high completion rates
    - Bonus for engagement (watch time, assignments, etc.)
    """
    
    PLATFORM_FEE_PERCENTAGE = Decimal('0.60')  # Coursera keeps 60%
    INSTRUCTOR_SHARE = Decimal('0.40')  # Instructors get 40%
    
    @classmethod
    def calculate_monthly_earnings(cls, month_date):
        """Calculate earnings for all instructors for a given month"""
        
        # Get or create revenue pool for the month
        revenue_pool, created = CourseraRevenuePool.objects.get_or_create(
            month=month_date,
            defaults={
                'total_subscription_revenue': cls._estimate_monthly_revenue(),
                'instructor_pool': cls._estimate_monthly_revenue() * cls.INSTRUCTOR_SHARE
            }
        )
        
        # Get all Coursera Plus courses with enrollments this month
        courses = Course.objects.filter(
            course_type='coursera_plus',
            enrollments__enrolled_date__month=month_date.month,
            enrollments__enrolled_date__year=month_date.year
        ).distinct()
        
        for course in courses:
            cls._calculate_course_earnings(course, month_date, revenue_pool)
    
    @classmethod
    def _calculate_course_earnings(cls, course, month_date, revenue_pool):
        """Calculate earnings for a specific course"""
        
        # Get metrics for this course this month
        month_start = month_date.replace(day=1)
        month_end = (month_start + timedelta(days=31)).replace(day=1)
        
        # Count enrollments
        enrollments = Enrollment.objects.filter(
            course=course,
            enrolled_date__gte=month_start,
            enrolled_date__lt=month_end
        )
        enrollment_count = enrollments.count()
        
        # Count completions
        completions = enrollments.filter(status='completed').count()
        completion_rate = (completions / enrollment_count) if enrollment_count > 0 else 0
        
        # Calculate total watch time
        total_watch_minutes = LectureProgress.objects.filter(
            enrollment__course=course,
            enrollment__enrolled_date__gte=month_start,
            enrollment__enrolled_date__lt=month_end
        ).aggregate(
            total=Sum('progress_seconds')
        )['total'] or 0
        total_watch_minutes = total_watch_minutes // 60
        
        # Calculate engagement score (0-100)
        engagement_score = cls._calculate_engagement_score(
            completion_rate, total_watch_minutes, enrollment_count
        )
        
        # Calculate base amount from revenue pool
        # Based on share of total platform enrollments
        total_platform_enrollments = Enrollment.objects.filter(
            course__course_type='coursera_plus',
            enrolled_date__gte=month_start,
            enrolled_date__lt=month_end
        ).count()
        
        enrollment_share = Decimal(enrollment_count) / Decimal(total_platform_enrollments) if total_platform_enrollments > 0 else 0
        base_amount = revenue_pool.instructor_pool * enrollment_share
        
        # Apply performance multiplier
        performance_multiplier = cls._calculate_performance_multiplier(
            completion_rate, engagement_score
        )
        
        final_amount = base_amount * performance_multiplier
        
        # Create or update earning record
        earning, created = InstructorEarning.objects.update_or_create(
            instructor=course.instructor,
            course=course,
            month=month_date,
            defaults={
                'earning_type': 'monthly_share',
                'enrollments_count': enrollment_count,
                'completions_count': completions,
                'total_watch_minutes': total_watch_minutes,
                'engagement_score': engagement_score,
                'base_amount': base_amount,
                'performance_multiplier': performance_multiplier,
                'final_amount': final_amount
            }
        )
        
        return earning
    
    @staticmethod
    def _calculate_engagement_score(completion_rate, watch_minutes, enrollments):
        """Calculate engagement score from 0-100"""
        # Weighted formula
        completion_weight = Decimal('0.4')
        watch_weight = Decimal('0.4')
        enrollment_weight = Decimal('0.2')
        
        # Normalize values
        completion_score = Decimal(completion_rate) * 100
        watch_score = min(Decimal(watch_minutes) / Decimal('1000'), Decimal('100'))  # Cap at 100
        enrollment_score = min(Decimal(enrollments) / Decimal('100'), Decimal('100'))  # Cap at 100
        
        engagement = (
            completion_score * completion_weight +
            watch_score * watch_weight +
            enrollment_score * enrollment_weight
        )
        
        return min(engagement, Decimal('100'))
    
    @staticmethod
    def _calculate_performance_multiplier(completion_rate, engagement_score):
        """
        Calculate performance multiplier (0.5 - 2.0)
        High completion and engagement = higher multiplier
        """
        base_multiplier = Decimal('1.0')
        
        # Bonus for high completion rate
        if completion_rate > 0.8:
            base_multiplier += Decimal('0.5')
        elif completion_rate > 0.6:
            base_multiplier += Decimal('0.3')
        elif completion_rate > 0.4:
            base_multiplier += Decimal('0.1')
        
        # Bonus for high engagement
        if engagement_score > 80:
            base_multiplier += Decimal('0.3')
        elif engagement_score > 60:
            base_multiplier += Decimal('0.2')
        elif engagement_score > 40:
            base_multiplier += Decimal('0.1')
        
        # Penalty for low performance
        if completion_rate < 0.2 and engagement_score < 30:
            base_multiplier = Decimal('0.5')
        
        return min(base_multiplier, Decimal('2.0'))
    
    @staticmethod
    def _estimate_monthly_revenue():
        """Estimate monthly revenue from subscriptions"""
        # This would connect to actual subscription data
        # For now, return a dummy value
        return Decimal('1000000.00')  # $1M monthly revenue pool