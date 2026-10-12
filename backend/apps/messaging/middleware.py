# discussions/middleware.py
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from urllib.parse import parse_qs
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user_from_token(token_string):
    """Get user from JWT token"""
    try:
        # Validate the token
        token = AccessToken(token_string)
        user_id = token['user_id']
        
        # Get the user
        user = User.objects.get(id=user_id)
        logger.info(f"WebSocket authentication successful for user: {user.email}")
        return user
    except (InvalidToken, TokenError, User.DoesNotExist) as e:
        logger.warning(f"WebSocket authentication failed: {e}")
        return AnonymousUser()

class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware to authenticate WebSocket connections using JWT tokens
    """
    
    async def __call__(self, scope, receive, send):
        # Only authenticate WebSocket connections
        if scope['type'] == 'websocket':
            # Parse query string to get token
            query_string = scope.get('query_string', b'').decode('utf-8')
            query_params = parse_qs(query_string)
            
            token = query_params.get('token', [None])[0]
            
            if token:
                # Get user from token
                scope['user'] = await get_user_from_token(token)
                logger.info(f"WebSocket scope user set to: {scope['user']}")
            else:
                logger.warning("No token found in WebSocket query parameters")
                scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)

def JWTAuthMiddlewareStack(inner):
    """
    Stack JWT auth middleware with other middlewares
    """
    return JWTAuthMiddleware(inner)
