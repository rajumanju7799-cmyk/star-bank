from __future__ import annotations

import os

from celery import Celery
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.getenv('DJANGO_SETTINGS_MODULE', 'config.settings.local'))

app = Celery('star_bank')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


@app.on_after_finalize.connect
def setup_periodic_tasks(sender, **kwargs):
    # Run hourly; task itself filters by each family's preferred reminder hour.
    sender.add_periodic_task(3600.0, send_daily_summaries_task.s(), name='send-daily-summaries-hourly')


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')


@app.task(name='apps.starbank.send_daily_summaries')
def send_daily_summaries_task():
    from apps.starbank.services import send_daily_summary_emails

    return send_daily_summary_emails()

