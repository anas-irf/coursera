# certificates/models.py
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.courses.models import Course
from apps.learning.models import Enrollment
import uuid
import hashlib

class CertificateTemplate(BaseModel):
    name = models.CharField(max_length=100)
    html_template = models.TextField()  # HTML template with placeholders
    css_styles = models.TextField(blank=True)
    
    # Design elements
    background_image = models.ImageField(upload_to='certificate_backgrounds/', 
                                        blank=True, null=True)
    signature_image = models.ImageField(upload_to='certificate_signatures/',
                                       blank=True, null=True)
    logo_image = models.ImageField(upload_to='certificate_logos/',
                                  blank=True, null=True)
    
    is_default = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'certificate_templates'

class Certificate(BaseModel):
    enrollment = models.OneToOneField(Enrollment, on_delete=models.CASCADE,
                                     related_name='certificate')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='certificates')
    course = models.ForeignKey(Course, on_delete=models.CASCADE,
                              related_name='certificates')
    
    certificate_number = models.CharField(max_length=50, unique=True)
    verification_code = models.CharField(max_length=100, unique=True)
    
    # Template used
    template = models.ForeignKey(CertificateTemplate, on_delete=models.SET_NULL,
                                null=True, blank=True)
    
    # Generated file
    pdf_file = models.FileField(upload_to='certificates/', blank=True, null=True)
    
    # Metadata
    issue_date = models.DateTimeField(auto_now_add=True)
    expiry_date = models.DateTimeField(null=True, blank=True)
    
    # Achievement details
    final_grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    completion_date = models.DateTimeField()
    
    class Meta:
        db_table = 'certificates'
        indexes = [
            models.Index(fields=['certificate_number']),
            models.Index(fields=['verification_code']),
        ]
    
    def generate_certificate_number(self):
        return f"CERT-{self.course.id[:8]}-{uuid.uuid4().hex[:8].upper()}"
    
    def generate_verification_code(self):
        data = f"{self.student.id}{self.course.id}{self.issue_date}"
        return hashlib.sha256(data.encode()).hexdigest()[:20]
    
    def save(self, *args, **kwargs):
        if not self.certificate_number:
            self.certificate_number = self.generate_certificate_number()
        if not self.verification_code:
            self.verification_code = self.generate_verification_code()
        super().save(*args, **kwargs)

class CertificateVerification(BaseModel):
    certificate = models.ForeignKey(Certificate, on_delete=models.CASCADE,
                                   related_name='verifications')
    verified_by_ip = models.GenericIPAddressField()
    verified_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'certificate_verifications'