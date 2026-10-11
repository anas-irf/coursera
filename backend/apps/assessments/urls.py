# assessments/urls.py - mounted at /api/assessments/
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api import instructor

app_name = 'assessments'

router = DefaultRouter()
router.register(r'quizzes', instructor.QuizViewSet, basename='quiz')

urlpatterns = [
    # historical: the quiz routes sit below an extra "api/" segment
    path('api/', include(router.urls)),
]
