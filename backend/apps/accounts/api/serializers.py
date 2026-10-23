"""Serializers of the accounts API: signup, login, the user with its profile, and its changes."""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import RegexValidator
from rest_framework import serializers

from .. import services
from ..models import StudentProfile, InstructorProfile

User = get_user_model()

PHONE = RegexValidator(regex=r'^\+?1?\d{9,15}$', message='Enter a phone number of 9 to 15 digits.')

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
    """The user as the API shows them: names, role, verification and what their profile page says."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'uuid', 'email', 'first_name', 'last_name', 'full_name',
                 'user_type', 'phone_number', 'email_verified', 'profile_picture',
                 'bio', 'country', 'city', 'expertise', 'linkedin_url', 'website_url',
                 'years_of_experience', 'date_joined')
        read_only_fields = ('id', 'uuid', 'date_joined')

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class ProfileUpdateSerializer(serializers.Serializer):
    """What a user may change of their own profile (``PATCH /auth/profile/``).

    Every field is optional.  The fields of another role are dropped, not refused: one form can
    send what it has, and a student never sets an instructor's payout address.
    """
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=15, allow_blank=True, validators=[PHONE])
    bio = serializers.CharField(max_length=500, allow_blank=True)
    country = serializers.CharField(max_length=100, allow_blank=True)
    city = serializers.CharField(max_length=100, allow_blank=True)
    # instructors
    expertise = serializers.CharField(max_length=500, allow_blank=True)
    linkedin_url = serializers.URLField(max_length=200, allow_blank=True)
    website_url = serializers.URLField(max_length=200, allow_blank=True)
    years_of_experience = serializers.IntegerField(min_value=0, max_value=80)
    payout_email = serializers.EmailField(allow_blank=True)
    # students
    learning_goals = serializers.CharField(max_length=1000, allow_blank=True)
    interests = serializers.ListField(
        child=serializers.CharField(max_length=40), max_length=10, allow_empty=True)

    def validate(self, attrs):
        allowed = services.profile_fields_for(self.context['user'])
        return {name: value for name, value in attrs.items() if name in allowed}


class ChangePasswordSerializer(serializers.Serializer):
    """The current password (proof it is the owner) and the new one, checked like at signup."""
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context['user'].check_password(value):
            raise serializers.ValidationError('Your current password is not correct.')
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value, self.context['user'])
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages)) from None
        return value

    def validate(self, attrs):
        if attrs['current_password'] == attrs['new_password']:
            raise serializers.ValidationError({'new_password': 'Choose a password you have not used here.'})
        return attrs


class DemoLoginSerializer(serializers.Serializer):
    """Which demo account to sign in as."""
    role = serializers.ChoiceField(choices=['student', 'instructor', 'admin'])

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
