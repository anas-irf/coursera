# core/models.py
from django.db import models
import uuid

class BaseModel(models.Model):
    """Abstract base model with common fields"""
    # id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True

class Category(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, 
                              on_delete=models.SET_NULL, related_name='subcategories')
    icon = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'Categories'
        ordering = ['name']
    
    def __str__(self):
        return self.name

class Tag(BaseModel):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)
    
    class Meta:
        db_table = 'tags'
    
    def __str__(self):
        return self.name

class Language(BaseModel):
    code = models.CharField(max_length=10, unique=True)  # e.g., 'en', 'es', 'fr'
    name = models.CharField(max_length=50)
    
    class Meta:
        db_table = 'languages'
    
    def __str__(self):
        return self.name