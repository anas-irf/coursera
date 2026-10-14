# accounts/api/views.py
from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .. import services
from .serializers import (
    SignupSerializer, LoginSerializer, UserSerializer, profile_payload,
)


@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    if serializer.is_valid():
        # the serializer creates the user together with the role profile
        user = serializer.save()

        return Response({
            'user': UserSerializer(user).data,
            'tokens': services.issue_tokens(user),
            'message': 'Registration successful!'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        # the authentication backend refuses inactive accounts itself, so one is answered
        # exactly like a wrong password and discloses nothing about the account
        user = authenticate(username=email, password=password)

        if user:
            services.record_login(user, request)

            return Response({
                'user': UserSerializer(user).data,
                'profile': profile_payload(user),
                'tokens': services.issue_tokens(user),
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
    except TokenError:
        return Response({"error": "Invalid or expired refresh token"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    return Response({
        'user': UserSerializer(request.user).data,
        'profile': profile_payload(request.user),
    })

