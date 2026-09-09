from __future__ import annotations

from collections import OrderedDict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any
from typing import Optional, Sequence, Tuple
from urllib.parse import urlparse

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Sum
from django.template.loader import render_to_string
from django.utils import timezone
from kombu import Connection

from .models import DailyTask, FamilySettings, KidProfile, StarAdjustment, TaskTemplate, WithdrawalRequest

User = get_user_model()

EMAIL_QUEUE_HEALTH_CACHE_KEY = 'email_queue_health_v1'
EMAIL_QUEUE_HEALTH_CACHE_SECONDS = 30


def get_email_queue_health(force_refresh: bool = False) -> dict[str, Any]:
    if not force_refresh:
        cached = cache.get(EMAIL_QUEUE_HEALTH_CACHE_KEY)
        if cached:
            return cached

    broker_url = settings.CELERY_BROKER_URL
    parsed = urlparse(broker_url)
    broker_label = parsed.scheme or 'broker'

    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        result = {
            'status': 'eager',
            'message': 'Background queue is bypassed (tasks run inline).',
            'broker': broker_label,
            'checked_at': timezone.now().isoformat(),
        }
        cache.set(EMAIL_QUEUE_HEALTH_CACHE_KEY, result, EMAIL_QUEUE_HEALTH_CACHE_SECONDS)
        return result

    try:
        connection = Connection(broker_url, connect_timeout=1)
        connection.connect()
        connection.release()
        result = {
            'status': 'healthy',
            'message': 'Queue broker is reachable.',
            'broker': broker_label,
            'checked_at': timezone.now().isoformat(),
        }
    except Exception:
        result = {
            'status': 'degraded',
            'message': 'Queue broker is unreachable. Activation emails may be delayed.',
            'broker': broker_label,
            'checked_at': timezone.now().isoformat(),
        }

    cache.set(EMAIL_QUEUE_HEALTH_CACHE_KEY, result, EMAIL_QUEUE_HEALTH_CACHE_SECONDS)
    return result


def bootstrap_family_account(user) -> None:
    settings_obj, _ = FamilySettings.objects.get_or_create(user=user)
    kid_exists = user.kids.exists()
    if not kid_exists:
        KidProfile.objects.create(user=user, name='Child', avatar_emoji='⭐')

    if not user.task_templates.exists():
        for sort_order, (name, stars) in enumerate(settings.STAR_BANK_DEFAULT_TASKS, start=1):
            TaskTemplate.objects.create(user=user, name=name, stars=stars, sort_order=sort_order)

    settings_obj.save()


def ensure_daily_tasks(kid: KidProfile, target_date: Optional[date] = None):
    target_date = target_date or timezone.localdate()
    templates = kid.user.task_templates.filter(is_active=True).order_by('sort_order', 'name')
    existing_types = set(
        DailyTask.objects.filter(kid=kid, date=target_date).values_list('task_type', flat=True)
    )

    missing = []
    for template in templates:
        if template.task_type in existing_types:
            continue
        missing.append(
            DailyTask(
                kid=kid,
                template=template,
                name=template.name,
                task_type=template.task_type,
                stars=template.stars,
                date=target_date,
            )
        )
    if missing:
        DailyTask.objects.bulk_create(missing)

    return DailyTask.objects.filter(kid=kid, date=target_date).select_related('template').order_by('completed_at', 'name')


def complete_task(task: DailyTask, family_settings: FamilySettings) -> tuple[bool, str]:
    if task.completed_at:
        return False, 'This task already got a star today.'

    today_total = get_today_star_total(task.kid, task.date)
    if today_total + task.stars > family_settings.daily_star_limit:
        return False, 'Daily star limit reached.'

    task.completed_at = timezone.now()
    task.save(update_fields=['completed_at'])
    return True, f'{task.name} earned {task.stars} star{"s" if task.stars != 1 else ""}!'


def add_custom_daily_task(kid: KidProfile, name: str, stars: int, target_date: Optional[date] = None) -> DailyTask:
    target_date = target_date or timezone.localdate()
    task = DailyTask.objects.create(
        kid=kid,
        name=name,
        stars=stars,
        date=target_date,
    )
    return task


def create_or_update_templates_for_user(user, tasks: Sequence[Tuple[str, int]]) -> None:
    normalized = {TaskTemplate(name=name, stars=stars, user=user, sort_order=index + 1).task_type: (name, stars, index)
                  for index, (name, stars) in enumerate(tasks)}

    with transaction.atomic():
        existing = {template.task_type: template for template in user.task_templates.all()}
        for task_type, (name, stars, index) in normalized.items():
            if task_type in existing:
                template = existing[task_type]
                template.name = name
                template.stars = stars
                template.sort_order = index + 1
                template.is_active = True
                template.save(update_fields=['name', 'stars', 'sort_order', 'is_active'])
            else:
                TaskTemplate.objects.create(user=user, name=name, stars=stars, sort_order=index + 1)

        for task_type, template in existing.items():
            if task_type not in normalized:
                template.is_active = False
                template.save(update_fields=['is_active'])

        for kid in user.kids.all():
            ensure_daily_tasks(kid)


def subtract_stars(kid: KidProfile, stars: int, reason: str, target_date: Optional[date] = None) -> None:
    StarAdjustment.objects.create(kid=kid, stars=stars, reason=reason, date=target_date or timezone.localdate())


def get_today_star_total(kid: KidProfile, target_date: Optional[date] = None) -> int:
    target_date = target_date or timezone.localdate()
    earned = DailyTask.objects.filter(kid=kid, date=target_date, completed_at__isnull=False).aggregate(total=Sum('stars'))['total'] or 0
    deducted = StarAdjustment.objects.filter(kid=kid, date=target_date).aggregate(total=Sum('stars'))['total'] or 0
    return max(0, earned - deducted)


def get_total_star_count(kid: KidProfile) -> int:
    earned = DailyTask.objects.filter(kid=kid, completed_at__isnull=False).aggregate(total=Sum('stars'))['total'] or 0
    deducted = StarAdjustment.objects.filter(kid=kid).aggregate(total=Sum('stars'))['total'] or 0
    return max(0, earned - deducted)


def get_weekly_report(kid: KidProfile):
    today = timezone.localdate()
    week_start = today - timedelta(days=today.weekday())
    report = OrderedDict()
    for offset in range(7):
        current = week_start + timedelta(days=offset)
        report[current] = get_today_star_total(kid, current)
    return report


def get_monthly_report(kid: KidProfile, month_anchor: Optional[date] = None):
    month_anchor = month_anchor or timezone.localdate()
    month_start = month_anchor.replace(day=1)
    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    days_in_month = (next_month - month_start).days
    report = OrderedDict()
    for day in range(days_in_month):
        current = month_start + timedelta(days=day)
        report[current] = get_today_star_total(kid, current)
    return report


def get_account_balance(kid: KidProfile, family_settings: FamilySettings):
    total_stars = get_total_star_count(kid)
    approved_withdrawals = WithdrawalRequest.objects.filter(kid=kid, status='approved').aggregate(total=Sum('approved_amount'))['total'] or Decimal('0')
    total_earned = Decimal(total_stars) / Decimal(family_settings.star_to_dollar_rate)
    return {
        'total_stars': total_stars,
        'total_earned': total_earned.quantize(Decimal('0.01')),
        'available_balance': (total_earned - approved_withdrawals).quantize(Decimal('0.01')),
    }


def send_daily_summary_emails(current_time=None) -> int:
    current_time = current_time or timezone.localtime()
    sent_count = 0

    for user in User.objects.filter(is_active=True).select_related('family_settings'):
        settings_obj = getattr(user, 'family_settings', None)
        if not settings_obj or not settings_obj.notifications_enabled:
            continue
        if settings_obj.daily_notification_hour != current_time.hour:
            continue

        kid = user.kids.first()
        if not kid:
            continue

        weekly_total = sum(get_weekly_report(kid).values())
        context = {
            'user': user,
            'kid': kid,
            'today_stars': get_today_star_total(kid),
            'total_stars': get_total_star_count(kid),
            'weekly_total': weekly_total,
            'site_name': settings.SITE_NAME,
        }
        body = render_to_string('emails/daily_summary.txt', context)
        send_mail(
            subject=f"{settings.SITE_NAME} daily summary for {kid.name}",
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        sent_count += 1

    return sent_count


