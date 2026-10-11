# assessments/services.py
from django.db.models import Avg, Sum, Count, Q
from decimal import Decimal, ROUND_HALF_UP

class GradeCalculationService:
    """Service for calculating student grades and course progress"""

    @staticmethod
    def calculate_student_course_grade(student, course):
        """Calculate a student's final grade for a course"""
        from .models import Assignment, Quiz, AssignmentSubmission, QuizAttempt
        from apps.learning.models import Enrollment

        try:
            enrollment = Enrollment.objects.get(student=student, course=course, status='active')
        except Enrollment.DoesNotExist:
            return None

        grade_components = []
        total_weight = Decimal('0')

        # Calculate assignment grades
        assignments = Assignment.objects.filter(course=course, is_active=True)
        assignment_score = Decimal('0')
        assignment_weight = Decimal('0')
        assignment_count = 0

        for assignment in assignments:
            try:
                submission = AssignmentSubmission.objects.get(
                    assignment=assignment,
                    student=student
                )
                if submission.grade is not None:
                    # Calculate percentage
                    percentage = (Decimal(str(submission.grade)) / Decimal(str(assignment.max_points))) * 100
                    assignment_score += percentage * Decimal(str(assignment.weight))
                    assignment_weight += Decimal(str(assignment.weight))
                    assignment_count += 1
            except AssignmentSubmission.DoesNotExist:
                # No submission - counts as 0
                assignment_weight += Decimal(str(assignment.weight))

        if assignment_weight > 0:
            assignment_average = assignment_score / assignment_weight if assignment_weight > 0 else Decimal('0')
            grade_components.append({
                'type': 'assignments',
                'score': assignment_average,
                'weight': assignment_weight,
                'completed': assignment_count,
                'total': assignments.count()
            })
            total_weight += assignment_weight

        # Calculate quiz grades
        quizzes = Quiz.objects.filter(course=course, is_active=True)
        quiz_score = Decimal('0')
        quiz_weight = Decimal('0')
        quiz_count = 0

        for quiz in quizzes:
            # Get best attempt for this quiz
            best_attempt = QuizAttempt.objects.filter(
                quiz=quiz,
                student=student
            ).order_by('-score').first()

            if best_attempt and best_attempt.score is not None:
                quiz_score += Decimal(str(best_attempt.score)) * Decimal(str(quiz.weight))
                quiz_weight += Decimal(str(quiz.weight))
                quiz_count += 1
            else:
                # No attempt - counts as 0
                quiz_weight += Decimal(str(quiz.weight))

        if quiz_weight > 0:
            quiz_average = quiz_score / quiz_weight if quiz_weight > 0 else Decimal('0')
            grade_components.append({
                'type': 'quizzes',
                'score': quiz_average,
                'weight': quiz_weight,
                'completed': quiz_count,
                'total': quizzes.count()
            })
            total_weight += quiz_weight

        # Calculate final grade
        if total_weight > 0:
            final_score = sum(
                component['score'] * component['weight'] for component in grade_components
            ) / total_weight
        else:
            final_score = Decimal('0')

        # Round to 2 decimal places
        final_score = final_score.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        return {
            'final_grade': float(final_score),
            'letter_grade': GradeCalculationService.get_letter_grade(final_score),
            'components': grade_components,
            'total_weight': float(total_weight),
            'is_passing': final_score >= 60  # Assuming 60% is passing
        }

    @staticmethod
    def get_letter_grade(percentage):
        """Convert percentage to letter grade"""
        if percentage >= 97:
            return 'A+'
        elif percentage >= 93:
            return 'A'
        elif percentage >= 90:
            return 'A-'
        elif percentage >= 87:
            return 'B+'
        elif percentage >= 83:
            return 'B'
        elif percentage >= 80:
            return 'B-'
        elif percentage >= 77:
            return 'C+'
        elif percentage >= 73:
            return 'C'
        elif percentage >= 70:
            return 'C-'
        elif percentage >= 67:
            return 'D+'
        elif percentage >= 63:
            return 'D'
        elif percentage >= 60:
            return 'D-'
        else:
            return 'F'

    @staticmethod
    def calculate_course_statistics(course):
        """Calculate statistics for all students in a course"""
        from .models import Assignment, Quiz, AssignmentSubmission, QuizAttempt
        from apps.learning.models import Enrollment

        enrollments = Enrollment.objects.filter(course=course, status='active')
        student_grades = []

        for enrollment in enrollments:
            grade_data = GradeCalculationService.calculate_student_course_grade(
                enrollment.student, course
            )
            if grade_data:
                student_grades.append({
                    'student': enrollment.student,
                    'grade_data': grade_data
                })

        if not student_grades:
            return None

        # Calculate course-wide statistics
        grades = [sg['grade_data']['final_grade'] for sg in student_grades]

        return {
            'total_students': len(student_grades),
            'average_grade': sum(grades) / len(grades) if grades else 0,
            'highest_grade': max(grades) if grades else 0,
            'lowest_grade': min(grades) if grades else 0,
            'passing_students': len([g for g in grades if g >= 60]),
            'failing_students': len([g for g in grades if g < 60]),
            'grade_distribution': GradeCalculationService._calculate_grade_distribution(grades)
        }

    @staticmethod
    def _calculate_grade_distribution(grades):
        """Calculate distribution of letter grades"""
        distribution = {
            'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0
        }

        for grade in grades:
            letter = GradeCalculationService.get_letter_grade(Decimal(str(grade)))
            if letter.startswith('A'):
                distribution['A'] += 1
            elif letter.startswith('B'):
                distribution['B'] += 1
            elif letter.startswith('C'):
                distribution['C'] += 1
            elif letter.startswith('D'):
                distribution['D'] += 1
            else:
                distribution['F'] += 1

        return distribution

    @staticmethod
    def get_student_gradebook(student):
        """Get comprehensive gradebook for a student across all courses"""
        from apps.learning.models import Enrollment

        enrollments = Enrollment.objects.filter(student=student, status='active')
        gradebook = []

        for enrollment in enrollments:
            grade_data = GradeCalculationService.calculate_student_course_grade(
                student, enrollment.course
            )

            if grade_data:
                gradebook.append({
                    'course_id': str(enrollment.course.uuid),
                    'course_title': enrollment.course.title,
                    'instructor': f"{enrollment.course.instructor.first_name} {enrollment.course.instructor.last_name}",
                    'enrollment_date': enrollment.enrolled_date,
                    'progress_percentage': enrollment.progress_percentage,
                    **grade_data
                })

        return gradebook