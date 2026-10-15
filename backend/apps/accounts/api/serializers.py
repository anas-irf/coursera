"""Serializers of the accounts API: signup, login and the user with its profile."""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .. import services
from ..models import StudentProfile, InstructorProfile

User = get_user_model()

class SignupSerializer(serializers.ModelSerializer):
    """Registration: validates the password and creates the user with the profile of its role."""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)
    user_type = serializers.ChoiceField(choices=['student', 'instructor'], default='student')

    class Meta:
        model = User
        fields = ('email', 'password', 'confirm_password', 'user_type', 
                 'first_name', 'last_name', 'phone_number')

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        return services.register(
            email=validated_data['email'],
            password=validated_data['password'],
            user_type=validated_data.get('user_type', 'student'),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', ''),
        )

class LoginSerializer(serializers.Serializer):
    """The e-mail address and password of a login."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

class UserSerializer(serializers.ModelSerializer):
    """The user as the API shows them: names, role and verification."""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'uuid', 'email', 'first_name', 'last_name', 'full_name', 
                 'user_type', 'phone_number', 'email_verified', 'profile_picture')
        read_only_fields = ('id', 'uuid')
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

class StudentProfileSerializer(serializers.ModelSerializer):
    """A student's profile with its user."""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = StudentProfile
        fields = '__all__'

class InstructorProfileSerializer(serializers.ModelSerializer):
    """An instructor's profile with its user."""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = InstructorProfile
        fields = '__all__'


def profile_payload(user):
    """Role profile of ``user`` serialized for API responses (``None`` for admins)."""
    if user.user_type == 'student' and hasattr(user, 'student_profile'):
        return StudentProfileSerializer(user.student_profile).data
    if user.user_type == 'instructor' and hasattr(user, 'instructor_profile'):
        return InstructorProfileSerializer(user.instructor_profile).data
    return None
