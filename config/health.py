from __future__ import annotations

from django.core.cache import cache
from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse
from django.utils import timezone


def healthz_view(_request):
    checks: dict[str, str] = {}

    try:
        with connections['default'].cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        checks['database'] = 'ok'
    except OperationalError:
        checks['database'] = 'error'

    try:
        cache.set('healthz_ping', 'ok', timeout=5)
        checks['cache'] = 'ok' if cache.get('healthz_ping') == 'ok' else 'error'
    except Exception:
        checks['cache'] = 'error'

    status = 'ok' if all(value == 'ok' for value in checks.values()) else 'degraded'
    status_code = 200 if status == 'ok' else 503

    return JsonResponse(
        {
            'status': status,
            'checks': checks,
            'timestamp': timezone.now().isoformat(),
        },
        status=status_code,
    )

