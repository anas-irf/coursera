# accounts/api/views.py
from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.decorators import (
    api_view, authentication_classes, permission_classes, throttle_classes,
)
from rest_framework.exceptions import NotAuthenticated
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.api.throttling import LoginThrottle, RefreshThrottle, SignupThrottle

from .. import cookies, services
from ..authentication import Unauthenticated, require_same_site_origin
from .serializers import (
    SignupSerializer, LoginSerializer, UserSerializer, profile_payload,
)


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([Unauthenticated])
@throttle_classes([SignupThrottle])
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
@authentication_classes([Unauthenticated])
@throttle_classes([LoginThrottle])
def login(request):
    """Sign in: the session cookies are set, and the answer says who signed in.

    The token pair is in the body only for callers that use bearer tokens
    (``AUTH_LEGACY_TOKEN_TRANSPORT`` or ``X-Auth-Transport: bearer``): a browser does not need it.
    """
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        # the authentication backend refuses inactive accounts itself, so one is answered
        # exactly like a wrong password and discloses nothing about the account
        user = authenticate(username=email, password=password)

        if user:
            services.record_login(user, request)
            tokens = services.issue_tokens(user)

            body = {
                'user': UserSerializer(user).data,
                'profile': profile_payload(user),
            }
            if cookies.bearer_transport(request):
                body['tokens'] = tokens
            return cookies.set_auth_cookies(Response(body), tokens)
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([Unauthenticated])    # the refresh token is the credential
@throttle_classes([RefreshThrottle])
def refresh(request):
    """Rotate the session: a new access token (and refresh token), set as cookies again.

    The refresh token comes from its cookie; a client that uses bearer tokens (or the front end of
    the release before cookies, once, to migrate) sends it in the body.
    """
    explicit = cookies.explicit_refresh_token(request)
    from_cookie = None if explicit else request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
    if explicit:
        data = {'refresh': explicit}
    elif from_cookie:
        require_same_site_origin(request)
        data = {'refresh': from_cookie}
    elif cookies.bearer_transport(request):
        data = request.data   # says what is missing
    else:
        raise NotAuthenticated()

    serializer = TokenRefreshSerializer(data=data)
    try:
        serializer.is_valid(raise_exception=True)
    except TokenError as error:
        raise InvalidToken(error.args[0]) from error
    tokens = serializer.validated_data

    # a browser that authenticated with its cookie never sees the tokens: only a caller that
    # presented the token itself (or asked for bearer transport) gets them back
    asks_for_tokens = request.headers.get('X-Auth-Transport') == 'bearer'
    if asks_for_tokens or (not from_cookie and cookies.bearer_transport(request)):
        response = Response(dict(tokens))
    else:
        response = Response(status=status.HTTP_204_NO_CONTENT)
    return cookies.set_auth_cookies(response, tokens)


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([Unauthenticated])    # signing out is authenticated by the refresh token
def logout(request):
    """Blacklist the refresh token and clear the session cookies (always, whatever the token says)."""
    raw = cookies.explicit_refresh_token(request)
    if raw is None:
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw:
            require_same_site_origin(request)   # a page of another site must not sign the user out

    response = Response({'message': 'Logged out successfully'}, status=status.HTTP_205_RESET_CONTENT)
    if raw:
        try:
            RefreshToken(raw).blacklist()
        except TokenError:
            response = Response({'error': 'Invalid or expired refresh token'},
                                status=status.HTTP_400_BAD_REQUEST)
    return cookies.clear_auth_cookies(response)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    return Response({
        'user': UserSerializer(request.user).data,
        'profile': profile_payload(request.user),
    })
