# accounts/management/commands/create_test_users.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Create test users for development'
    
    def handle(self, *args, **options):
        # Create test instructor
        instructor_email = 'instructor@test.com'
        if not User.objects.filter(email=instructor_email).exists():
            instructor = User.objects.create_user(
                username=instructor_email,  # Use email as username
                email=instructor_email,
                password='testpass123',
                first_name='Test',
                last_name='Instructor',
                user_type='instructor',
                is_active=True,
                email_verified=True,
                bio='Test instructor for development',
                phone_number='+1234567890',
                expertise='Full Stack Development, Django, React',
                years_of_experience=5
            )
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created instructor: {instructor_email}')
            )
        else:
            self.stdout.write(
                self.style.WARNING(f'Instructor {instructor_email} already exists')
            )
        
        # Create test student
        student_email = 'student@test.com'
        if not User.objects.filter(email=student_email).exists():
            student = User.objects.create_user(
                username=student_email,  # Use email as username
                email=student_email,
                password='testpass123',
                first_name='Test',
                last_name='Student',
                user_type='student',
                is_active=True,
                email_verified=True,
                bio='Test student for development',
                phone_number='+1234567891'
            )
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created student: {student_email}')
            )
        else:
            self.stdout.write(
                self.style.WARNING(f'Student {student_email} already exists')
            )
            
        self.stdout.write(
            self.style.SUCCESS('Test users creation completed!')
        )