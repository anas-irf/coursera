# certificates/models.py
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.courses.models import Course
from apps.learning.models import Enrollment
import secrets

class Certificate(BaseModel):
    enrollment = models.OneToOneField(Enrollment, on_delete=models.CASCADE,
                                     related_name='certificate')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='certificates')
    course = models.ForeignKey(Course, on_delete=models.CASCADE,
                              related_name='certificates')
    
    certificate_number = models.CharField(max_length=50, unique=True)
    verification_code = models.CharField(max_length=100, unique=True)
    
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
        """``CERT-<course>-<random>``: readable, and not derivable from anything else."""
        return f'CERT-{self.course.uuid.hex[:8].upper()}-{secrets.token_hex(5).upper()}'

    def generate_verification_code(self):
        """Random (80 bits): knowing a student and a course does not give the code."""
        return secrets.token_hex(10)
    
    def save(self, *args, **kwargs):
        if not self.certificate_number:
            self.certificate_number = self.generate_certificate_number()
        if not self.verification_code:
            self.verification_code = self.generate_verification_code()
        super().save(*args, **kwargs)
