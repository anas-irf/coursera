"""A urlconf without the unversioned aliases: what the project looks like once they are switched off."""
from config.urls import build_urlpatterns

urlpatterns = build_urlpatterns(legacy=False)
