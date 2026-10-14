# messaging/models.py
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel

class DirectMessage(BaseModel):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name='sent_messages')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                 related_name='received_messages')

    # For conversation grouping - helps group messages between two users
    conversation_id = models.CharField(max_length=100, db_index=True, default='')

    subject = models.CharField(max_length=200, blank=True)  # Optional for chat-style messages
    content = models.TextField()

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    # For threading (keeping existing functionality)
    parent_message = models.ForeignKey('self', null=True, blank=True,
                                      on_delete=models.SET_NULL, related_name='replies')

    class Meta:
        db_table = 'direct_messages'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['conversation_id', '-created_at']),
            models.Index(fields=['sender', 'recipient']),
        ]

    def save(self, *args, **kwargs):
        if not self.conversation_id:
            self.conversation_id = self.get_conversation_id(self.sender, self.recipient)
        super().save(*args, **kwargs)

    @classmethod
    def get_conversation_id(cls, user1, user2):
        """Conversation id of two users (the ids are sorted as strings, "10" < "9")"""
        user_ids = sorted([str(user1.id), str(user2.id)])
        return f"conv_{user_ids[0]}_{user_ids[1]}"
