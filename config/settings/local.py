from __future__ import annotations

import os

from .base import *  # noqa

DEBUG = True
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']

# Keep local dev flexible: use EMAIL_BACKEND from .env when provided.
# If omitted, base.py already defaults to console backend.

# Keep requests responsive locally: queue tasks asynchronously by default.
# Set CELERY_TASK_ALWAYS_EAGER=True explicitly in .env if you want sync task execution.
CELERY_TASK_ALWAYS_EAGER = os.getenv('CELERY_TASK_ALWAYS_EAGER', 'False').lower() == 'true'

# Use console email backend for local development unless overridden in .env
if not os.getenv('DJANGO_EMAIL_BACKEND'):
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

