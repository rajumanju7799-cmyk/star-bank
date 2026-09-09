from __future__ import annotations

from django.conf import settings
from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


THEME_CHOICES = [
    ('sunny', 'Sunny Yellow'),
    ('sky', 'Sky Blue'),
    ('forest', 'Forest Green'),
    ('candy', 'Candy Pink'),
]

WITHDRAWAL_STATUS = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]

WITHDRAWAL_CATEGORY = [
    ('spend', 'Spend'),
    ('save', 'Save'),
    ('invest', 'Invest'),
    ('charity', 'Charity'),
]


def normalize_task_type(name: str) -> str:
    return ' '.join(name.strip().lower().split())


class FamilySettings(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='family_settings')
    parent_pin = models.CharField(max_length=128, default='1234')
    star_to_dollar_rate = models.PositiveIntegerField(default=2)
    daily_star_limit = models.PositiveIntegerField(default=10)
    theme = models.CharField(max_length=20, choices=THEME_CHOICES, default='sunny')
    notifications_enabled = models.BooleanField(default=False)
    daily_notification_hour = models.PositiveSmallIntegerField(default=18)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f'Settings for {self.user}'

    def clean(self):
        super().clean()
        if not 0 <= self.daily_notification_hour <= 23:
            raise ValidationError({'daily_notification_hour': 'Notification hour must be between 0 and 23.'})

    def set_parent_pin(self, raw_pin: str) -> None:
        self.parent_pin = make_password(raw_pin)

    def verify_parent_pin(self, raw_pin: str) -> bool:
        # Backward compatibility: auto-upgrade legacy plain-text pins to hashed values.
        try:
            identify_hasher(self.parent_pin)
            return check_password(raw_pin, self.parent_pin)
        except Exception:
            is_match = self.parent_pin == raw_pin
            if is_match:
                self.set_parent_pin(raw_pin)
                self.save(update_fields=['parent_pin', 'updated_at'])
            return is_match

    def save(self, *args, **kwargs):
        # Keep raw legacy defaults from ending up in the DB.
        if self.parent_pin and self.parent_pin.isdigit() and len(self.parent_pin) == 4:
            self.set_parent_pin(self.parent_pin)
        super().save(*args, **kwargs)


class KidProfile(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='kids')
    name = models.CharField(max_length=120)
    avatar_emoji = models.CharField(max_length=8, default='⭐')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class TaskTemplate(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='task_templates')
    name = models.CharField(max_length=200)
    task_type = models.CharField(max_length=200)
    stars = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        unique_together = [('user', 'task_type')]

    def save(self, *args, **kwargs):
        self.task_type = normalize_task_type(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class DailyTask(models.Model):
    kid = models.ForeignKey(KidProfile, on_delete=models.CASCADE, related_name='daily_tasks')
    template = models.ForeignKey(TaskTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='daily_instances')
    name = models.CharField(max_length=200)
    task_type = models.CharField(max_length=200)
    stars = models.PositiveIntegerField(default=1)
    date = models.DateField(default=timezone.localdate)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['completed_at', 'name']
        unique_together = [('kid', 'date', 'task_type')]

    @property
    def is_completed(self) -> bool:
        return self.completed_at is not None

    def save(self, *args, **kwargs):
        self.task_type = normalize_task_type(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f'{self.name} ({self.kid.name} - {self.date})'


class StarAdjustment(models.Model):
    kid = models.ForeignKey(KidProfile, on_delete=models.CASCADE, related_name='star_adjustments')
    stars = models.PositiveIntegerField()
    reason = models.CharField(max_length=255)
    date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'-{self.stars} for {self.kid.name}'


class SavingsGoal(models.Model):
    kid = models.ForeignKey(KidProfile, on_delete=models.CASCADE, related_name='savings_goals')
    name = models.CharField(max_length=120)
    target_amount = models.DecimalField(max_digits=10, decimal_places=2)
    current_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    image_emoji = models.CharField(max_length=8, blank=True, default='🎯')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return f'{self.name} ({self.kid.name})'


class WithdrawalRequest(models.Model):
    kid = models.ForeignKey(KidProfile, on_delete=models.CASCADE, related_name='withdrawal_requests')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=20, choices=WITHDRAWAL_CATEGORY)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=WITHDRAWAL_STATUS, default='pending')
    comments = models.TextField(blank=True)
    approved_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.kid.name} requested {self.amount}'

