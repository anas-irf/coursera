# notifications/services.py
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from .models import Notification


class NotificationService:
    """Service for creating and managing notifications"""

    @staticmethod
    def create_course_rejection_notification(course, rejection_reason, rejected_by):
        """Create notification for course rejection"""
        try:
            # Get ContentType for Course model
            from apps.courses.models import Course
            course_content_type = ContentType.objects.get_for_model(Course)

            # Create notification for instructor
            instructor_notification = Notification.objects.create(
                recipient=course.instructor,
                notification_type='course_rejected',
                title=f'Course "{course.title}" was rejected',
                message=f'Your course "{course.title}" has been rejected by {rejected_by.get_full_name() or rejected_by.email}.\n\nReason: {rejection_reason}\n\nYou can view the rejection details and resubmit your course after addressing the feedback.',
                content_type=course_content_type,
                object_id=str(course.uuid),
                action_url=f'/instructor/courses',  # URL to instructor courses page
            )

            # Create notification for admin who rejected (for record keeping)
            admin_notification = Notification.objects.create(
                recipient=rejected_by,
                notification_type='course_rejected',
                title=f'Course "{course.title}" rejected',
                message=f'You have successfully rejected the course "{course.title}" by {course.instructor.get_full_name() or course.instructor.email}.\n\nReason provided: {rejection_reason}',
                content_type=course_content_type,
                object_id=str(course.uuid),
                action_url=f'/admin/courses',  # URL to admin courses page
            )

            return {
                'instructor_notification': instructor_notification,
                'admin_notification': admin_notification
            }

        except Exception as e:
            print(f"Error creating course rejection notification: {str(e)}")
            return None

    @staticmethod
    def create_course_approval_notification(course, approved_by):
        """Create notification for course approval"""
        try:
            from apps.courses.models import Course
            course_content_type = ContentType.objects.get_for_model(Course)

            # Create notification for instructor
            instructor_notification = Notification.objects.create(
                recipient=course.instructor,
                notification_type='course_approved',
                title=f'Course "{course.title}" was approved!',
                message=f'Congratulations! Your course "{course.title}" has been approved and published by {approved_by.get_full_name() or approved_by.email}.\n\nYour course is now live and available to students.',
                content_type=course_content_type,
                object_id=str(course.uuid),
                action_url=f'/instructor/courses',
            )

            # Create notification for admin who approved (for record keeping)
            admin_notification = Notification.objects.create(
                recipient=approved_by,
                notification_type='course_approved',
                title=f'Course "{course.title}" approved',
                message=f'You have successfully approved and published the course "{course.title}" by {course.instructor.get_full_name() or course.instructor.email}.\n\nThe course is now live and available to students.',
                content_type=course_content_type,
                object_id=str(course.uuid),
                action_url=f'/admin/courses',
            )

            return {
                'instructor_notification': instructor_notification,
                'admin_notification': admin_notification
            }

        except Exception as e:
            print(f"Error creating course approval notification: {str(e)}")
            return None

    @staticmethod
    def create_course_submission_notification(course):
        """Create notification for course submission for review"""
        try:
            from apps.courses.models import Course
            from apps.accounts.models import User
            course_content_type = ContentType.objects.get_for_model(Course)

            # Get all admin users
            admin_users = User.objects.filter(user_type='admin')

            notifications_created = []

            # Create notification for each admin
            for admin in admin_users:
                notification = Notification.objects.create(
                    recipient=admin,
                    notification_type='course_submission',
                    title=f'New course submitted for review',
                    message=f'A new course "{course.title}" by {course.instructor.get_full_name() or course.instructor.email} has been submitted for review.\n\nPlease review and approve or reject the course.',
                    content_type=course_content_type,
                    object_id=str(course.uuid),
                    action_url=f'/admin/courses/approvals',
                )
                notifications_created.append(notification)

            return notifications_created

        except Exception as e:
            print(f"Error creating course submission notification: {str(e)}")
            return None

    @staticmethod
    def create_enrollment_notification(enrollment):
        """Create notification for new enrollment"""
        try:
            from apps.courses.models import Course
            from apps.learning.models import Enrollment
            course_content_type = ContentType.objects.get_for_model(Course)
            enrollment_content_type = ContentType.objects.get_for_model(Enrollment)

            course = enrollment.course
            student = enrollment.student

            # Create notification for the student (enrollment confirmation)
            student_notification = Notification.objects.create(
                recipient=student,
                notification_type='enrollment',
                title=f'Successfully enrolled in "{course.title}"',
                message=f'Welcome! You have successfully enrolled in "{course.title}" by {course.instructor.get_full_name() or course.instructor.email}.\n\nYou can now start learning. Go to your dashboard to begin your first lesson.',
                content_type=course_content_type,
                object_id=str(course.uuid),
                action_url=f'/courses/{course.uuid}/learn',
            )

            # Create notification for the instructor (new student enrolled)
            instructor_notification = Notification.objects.create(
                recipient=course.instructor,
                notification_type='enrollment',
                title=f'New student enrolled in "{course.title}"',
                message=f'{student.get_full_name() or student.email} has enrolled in your course "{course.title}".\n\nYour course now has {course.total_enrolled} enrolled students.',
                content_type=enrollment_content_type,
                object_id=str(enrollment.uuid),
                action_url=f'/instructor/courses',
            )

            return {
                'student_notification': student_notification,
                'instructor_notification': instructor_notification
            }

        except Exception as e:
            print(f"Error creating enrollment notification: {str(e)}")
            return None

    @staticmethod
    def create_certificate_earned_notification(enrollment, certificate):
        """Create notification for certificate earned"""
        try:
            from apps.courses.models import Course
            from apps.certificates.models import Certificate
            course_content_type = ContentType.objects.get_for_model(Course)

            course = enrollment.course
            student = enrollment.student

            # Create notification for the student
            student_notification = Notification.objects.create(
                recipient=student,
                notification_type='certificate_earned',
                title=f'Congratulations! Certificate earned for "{course.title}"',
                message=f'🎉 Congratulations! You have successfully completed "{course.title}" and earned your certificate.\n\nYou can download your certificate from your dashboard.',
                content_type=course_content_type,
                object_id=str(course.uuid),
                action_url=f'/student/certificates',
            )

            return {
                'student_notification': student_notification
            }

        except Exception as e:
            print(f"Error creating certificate earned notification: {str(e)}")
            return None

    @staticmethod
    def create_assignment_due_notification(assignment, student):
        """Create notification for assignment due reminder"""
        try:
            from apps.assessments.models import Assignment
            from apps.courses.models import Course
            assignment_content_type = ContentType.objects.get_for_model(Assignment)

            # Create notification for the student
            student_notification = Notification.objects.create(
                recipient=student,
                notification_type='assignment_due',
                title=f'Assignment due soon: "{assignment.title}"',
                message=f'Reminder: Your assignment "{assignment.title}" in "{assignment.course.title}" is due soon.\n\nDue date: {assignment.due_date.strftime("%B %d, %Y at %I:%M %p") if assignment.due_date else "No due date set"}',
                content_type=assignment_content_type,
                object_id=str(assignment.uuid),
                action_url=f'/courses/{assignment.course.uuid}/learn',
            )

            return {
                'student_notification': student_notification
            }

        except Exception as e:
            print(f"Error creating assignment due notification: {str(e)}")
            return None

    @staticmethod
    def create_course_announcement_notification(course, announcement, students=None):
        """Create notification for course announcements"""
        try:
            from apps.courses.models import Course
            from apps.learning.models import Enrollment
            course_content_type = ContentType.objects.get_for_model(Course)

            notifications_created = []

            # Get all enrolled students if no specific students provided
            if students is None:
                enrollments = Enrollment.objects.filter(course=course, status='active')
                students = [enrollment.student for enrollment in enrollments]

            # Create notification for each student
            for student in students:
                notification = Notification.objects.create(
                    recipient=student,
                    notification_type='announcement',
                    title=f'New announcement in "{course.title}"',
                    message=f'Your instructor has posted a new announcement in "{course.title}".\n\n{announcement[:200]}{"..." if len(announcement) > 200 else ""}',
                    content_type=course_content_type,
                    object_id=str(course.uuid),
                    action_url=f'/courses/{course.uuid}/learn',
                )
                notifications_created.append(notification)

            return notifications_created

        except Exception as e:
            print(f"Error creating course announcement notification: {str(e)}")
            return None

    @staticmethod
    def mark_as_read(notification_id, user):
        """Mark a notification as read"""
        try:
            notification = Notification.objects.get(
                id=notification_id,
                recipient=user
            )
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save()
            return notification
        except Notification.DoesNotExist:
            return None

    @staticmethod
    def get_unread_count(user):
        """Get count of unread notifications for user"""
        return Notification.objects.filter(
            recipient=user,
            is_read=False
        ).count()

    @staticmethod
    def get_user_notifications(user, limit=20, include_read=True):
        """Get notifications for a user"""
        queryset = Notification.objects.filter(recipient=user)

        if not include_read:
            queryset = queryset.filter(is_read=False)

        return queryset.order_by('-created_at')[:limit]