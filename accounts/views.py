# accounts/views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models
from datetime import timedelta
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import (
    SignupSerializer, LoginSerializer, UserSerializer,
    StudentProfileSerializer, InstructorProfileSerializer
)
from .models import StudentPlusSubscription, StudentPlusPayment
import secrets

# Get the User model
User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()

        # Ensure student users are created as free students by default
        if user.user_type == 'student':
            # Create student profile if it doesn't exist
            from .models import StudentProfile
            student_profile, created = StudentProfile.objects.get_or_create(
                user=user,
                defaults={
                    'learning_streak': 0,
                    'total_learning_hours': 0.00
                }
            )

        # Generate email verification token
        user.email_verification_token = secrets.token_urlsafe(32)
        user.save(update_fields=['email_verification_token'])
        
        # TODO: Send verification email here
        # send_verification_email(user.email, user.email_verification_token)
        
        refresh = RefreshToken.for_user(user)
        
        # Add custom claims to token
        refresh['user_type'] = user.user_type
        refresh['uuid'] = str(user.uuid)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': 'Registration successful! Please check your email to verify your account.'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        
        user = authenticate(username=email, password=password)
        
        if user:
            if not user.is_active:
                return Response(
                    {'error': 'Your account has been deactivated. Please contact support.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Update last login IP
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0]
            else:
                ip = request.META.get('REMOTE_ADDR')
            user.last_login_ip = ip
            user.save(update_fields=['last_login_ip', 'last_login'])
            
            refresh = RefreshToken.for_user(user)
            
            # Add custom claims
            refresh['user_type'] = user.user_type
            refresh['uuid'] = str(user.uuid)
            
            # Get profile data based on user type
            profile_data = None
            if user.user_type == 'student' and hasattr(user, 'student_profile'):
                profile_data = StudentProfileSerializer(user.student_profile).data
            elif user.user_type == 'instructor' and hasattr(user, 'instructor_profile'):
                profile_data = InstructorProfileSerializer(user.instructor_profile).data
            
            return Response({
                'user': UserSerializer(user).data,
                'profile': profile_data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            })
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data.get("refresh")
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({"message": "Logged out successfully"}, status=status.HTTP_205_RESET_CONTENT)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    user = request.user
    user_data = UserSerializer(user).data
    
    # Get profile based on user type
    profile_data = None
    if user.user_type == 'student' and hasattr(user, 'student_profile'):
        profile_data = StudentProfileSerializer(user.student_profile).data
    elif user.user_type == 'instructor' and hasattr(user, 'instructor_profile'):
        profile_data = InstructorProfileSerializer(user.instructor_profile).data
    
    return Response({
        'user': user_data,
        'profile': profile_data
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def verify_email(request, token):
    try:
        user = User.objects.get(email_verification_token=token)
        user.email_verified = True
        user.email_verification_token = None
        user.save(update_fields=['email_verified', 'email_verification_token'])
        return Response({'message': 'Email verified successfully!'})
    except User.DoesNotExist:
        return Response({'error': 'Invalid verification token'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_subscription_status(request):
    """Get current user's subscription status"""
    try:
        user = request.user
        if user.user_type != 'student':
            return Response(
                {'error': 'Only students can check subscription status'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Explicitly query the StudentPlusSubscription table
        subscription = None
        try:
            subscription = StudentPlusSubscription.objects.get(student=user)
        except StudentPlusSubscription.DoesNotExist:
            subscription = None

        if subscription:
            data = {
                'has_subscription': True,
                'status': subscription.status,
                'subscription_type': subscription.subscription_type,
                'is_active': subscription.is_active(),
                'can_access_plus_courses': subscription.can_access_plus_courses(),
                'start_date': subscription.start_date.isoformat(),
                'end_date': subscription.end_date.isoformat() if subscription.end_date else None,
                'auto_renew': subscription.auto_renew,
                'next_billing_date': subscription.next_billing_date.isoformat() if subscription.next_billing_date else None
            }
        else:
            data = {
                'has_subscription': False,
                'status': 'none',
                'subscription_type': None,
                'is_active': False,
                'can_access_plus_courses': False,
                'start_date': None,
                'end_date': None,
                'auto_renew': False,
                'next_billing_date': None
            }

        return Response(data)

    except Exception as e:
        return Response(
            {'error': f'Failed to get subscription status: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_plus_subscription(request):
    """Cancel Plus subscription"""
    try:
        user = request.user
        subscription = get_object_or_404(StudentPlusSubscription, student=user)

        subscription.status = 'cancelled'
        subscription.auto_renew = False
        subscription.save()

        return Response({
            'message': 'Subscription cancelled successfully'
        })

    except StudentPlusSubscription.DoesNotExist:
        return Response(
            {'error': 'No active subscription found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to cancel subscription: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_stats(request):
    """Get student learning statistics"""
    try:
        user = request.user
        if user.user_type != 'student':
            return Response(
                {'error': 'Only students can access stats'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get enrollment data
        from enrollments.models import Enrollment
        enrollments = Enrollment.objects.filter(student=user)

        active_enrollments = enrollments.filter(status='active')
        completed_enrollments = enrollments.filter(status='completed')

        # Calculate total progress
        total_progress = 0
        if enrollments.exists():
            total_progress = enrollments.aggregate(
                avg_progress=models.Avg('progress_percentage')
            )['avg_progress'] or 0

        # Get certificates
        certificates_earned = completed_enrollments.filter(certificate_issued=True).count()

        # Get subscription status
        has_plus = user.has_plus_access

        return Response({
            'courses_enrolled': enrollments.count(),
            'courses_active': active_enrollments.count(),
            'courses_completed': completed_enrollments.count(),
            'certificates_earned': certificates_earned,
            'total_progress': round(total_progress, 1),
            'has_plus_subscription': has_plus,
            'learning_streak': getattr(user.student_profile, 'learning_streak', 0) if hasattr(user, 'student_profile') else 0,
            'total_learning_hours': float(getattr(user.student_profile, 'total_learning_hours', 0)) if hasattr(user, 'student_profile') else 0
        })

    except Exception as e:
        return Response(
            {'error': f'Failed to get student stats: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_weekly_progress(request):
    """Get student's weekly learning progress"""
    try:
        user = request.user
        if user.user_type != 'student':
            return Response(
                {'error': 'Only students can access weekly progress'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Generate sample weekly progress data (replace with real implementation later)
        from datetime import datetime, timedelta
        import calendar

        # Get last 4 months for demonstration
        today = timezone.now().date()
        months_data = []

        for i in range(4):
            month_date = today.replace(day=1) - timedelta(days=i*30)
            month_name = calendar.month_abbr[month_date.month]

            # Mock hours learned per month (replace with real data from learning activities)
            mock_hours = [25, 32, 28, 42][i] if i < 4 else 20

            months_data.append({
                'month': month_name,
                'hours': mock_hours
            })

        months_data.reverse()  # Show chronological order

        return Response({
            'monthly_progress': months_data
        })

    except Exception as e:
        return Response(
            {'error': f'Failed to get weekly progress: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
