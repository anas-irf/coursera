# certificates/urls.py - mounted at /api/certificates/
from django.urls import path

from .api import views

app_name = 'certificates'

urlpatterns = [
    path('', views.student_certificates, name='student-certificates'),
]
