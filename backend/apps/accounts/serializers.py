# accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import StudentProfile, InstructorProfile

User = get_user_model()

class SignupSerializer(serializers.ModelSerializer):
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
        user_type = validated_data.pop('user_type', 'student')
        
        # Create user
        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['email'],  # Using email as username
            password=validated_data['password'],
            user_type=user_type,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', ''),
        )
        
        # Create profile based on user type
        if user_type == 'student':
            StudentProfile.objects.create(user=user)
        elif user_type == 'instructor':
            InstructorProfile.objects.create(user=user)
            
        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'uuid', 'email', 'first_name', 'last_name', 'full_name', 
                 'user_type', 'phone_number', 'email_verified', 'profile_picture')
        read_only_fields = ('id', 'uuid')
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = StudentProfile
        fields = '__all__'

class InstructorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = InstructorProfile
        fields = '__all__'