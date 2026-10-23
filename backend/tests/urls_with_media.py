"""The project's urlconf as a demo with ``SERVE_MEDIA`` builds it: the uploads are served by Django."""
from config.urls import build_urlpatterns, media_patterns

urlpatterns = build_urlpatterns(legacy=False) + media_patterns()
