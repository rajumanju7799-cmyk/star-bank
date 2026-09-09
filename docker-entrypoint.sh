#!/bin/sh
set -e

echo "[entrypoint] Running Django deployment checks..."
python manage.py check --deploy

echo "[entrypoint] Applying database migrations..."
python manage.py migrate --noinput

echo "[entrypoint] Collecting static assets..."
python manage.py collectstatic --noinput

exec "$@"
