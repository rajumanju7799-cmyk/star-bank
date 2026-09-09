# Star Bank

Star Bank is a Django-based family rewards platform where parents manage tasks, stars, and withdrawals while kids track daily progress and goals.

## Features

- Account registration/login with email activation flow
- Parent PIN-gated parent mode
- Kid and parent dashboards
- Daily task creation, completion, and star awarding
- Daily star limit enforcement
- Star subtraction with reason tracking
- Savings goals and withdrawal requests
- Family settings (including UI theme selection)
- Daily summary notifications via management command / Celery

## Tech stack

- Python 3.10+
- Django 5.x
- uv for Python dependency management (`pyproject.toml`)
- SQLite (default local fallback) or PostgreSQL via `DATABASE_URL`
- WhiteNoise for static files
- Celery + Redis for async/background jobs
- Optional frontend tooling: Vite/React (in `src/`)

## Repository layout

```text
star-bank/
  apps/
	accounts/
	starbank/
  config/
	settings/
	  base.py
	  local.py
	  production.py
  templates/
  static/
  manage.py
  pyproject.toml
  requirements.txt
  docker-compose.yml
```

## Local development (recommended: uv)

### 1) Prerequisites

- Python 3.10+
- `uv` installed

### 2) Clone and install dependencies

```powershell
cd C:\projects\star-bank
uv sync
```

### 3) Create `.env`

Copy `.env.example` to `.env` and start with local-safe values:

```dotenv
DJANGO_SETTINGS_MODULE=config.settings.local
DJANGO_SECRET_KEY=change-me-in-local
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
DJANGO_CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8000,http://localhost:8000
SITE_URL=http://127.0.0.1:8000
```

Database options:

- SQLite local fallback: omit `DATABASE_URL`
- Local Postgres from host machine:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/starbank
```

Important: if running locally outside Docker, do not use `@db:5432` in `DATABASE_URL`.

### 4) Migrate and create admin user

```powershell
cd C:\projects\star-bank
uv run python manage.py migrate
uv run python manage.py createsuperuser
```

### 5) Run server

```powershell
cd C:\projects\star-bank
uv run python manage.py runserver
```

Open `http://127.0.0.1:8000`.

## Common developer commands

```powershell
cd C:\projects\star-bank
uv run python manage.py check
uv run python manage.py test
uv run python manage.py collectstatic --noinput
```

## Email and activation setup

For real email delivery, configure SMTP in `.env`:

```dotenv
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-real-smtp-key
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
DEFAULT_FROM_EMAIL=Star Bank <noreply@littlestarbank.com>
SITE_URL=https://littlestarbank.com
```

In local dev, console email backend can be used to inspect emails in terminal output.

## Production secrets and credentials

Generate values like this:

### `DJANGO_SECRET_KEY`

```powershell
cd C:\projects\star-bank
uv run python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### `POSTGRES_PASSWORD` and `DATABASE_URL` password segment

Use the same strong password for both if you manage your own Postgres container.

```powershell
cd C:\projects\star-bank
uv run python -c "import secrets,string; chars=string.ascii_letters+string.digits+'!@#$%^&*()-_=+'; print(''.join(secrets.choice(chars) for _ in range(40)))"
```

Then update:

- `POSTGRES_PASSWORD=<generated-password>`
- `DATABASE_URL=postgresql://starbank:<generated-password>@db:5432/starbank`

If you use managed Postgres (Render/Railway/Supabase/Neon), the platform gives you a full `DATABASE_URL`; use that directly and you do not need to manually set a separate DB password in app config.

### `EMAIL_HOST_PASSWORD`

- This comes from your email provider (for example SendGrid API key or SMTP password).
- Create/retrieve it in the provider dashboard and paste it into `.env.prod`.

## Background jobs (Celery)

Set Redis URLs in `.env`:

```dotenv
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0
```

Run worker and beat:

```powershell
cd C:\projects\star-bank
uv run celery -A config worker -l info
uv run celery -A config beat -l info
```

Daily summary command (can be scheduled):

```powershell
cd C:\projects\star-bank
uv run python manage.py send_daily_summaries
```

## Docker development

The project includes `Dockerfile` and `docker-compose.yml` for web + postgres + redis + worker + beat.

```powershell
cd C:\projects\star-bank
docker compose up --build
```

Services started:

- `web` (Django/Gunicorn)
- `db` (PostgreSQL 16)
- `redis`
- `worker` (Celery)
- `beat` (Celery beat)

## Optional frontend workflow (Vite/React)

If you are working on `src/` frontend assets:

```powershell
cd C:\projects\star-bank
npm install
npm run dev
```

Other scripts:

```powershell
npm run build
npm run preview
npm run lint
```

## Production notes

- Use `config.settings.production`
- Set a strong `DJANGO_SECRET_KEY` (64+ random chars)
- Configure `DJANGO_ALLOWED_HOSTS` and `DJANGO_CSRF_TRUSTED_ORIGINS` for your domain
- Use PostgreSQL + Redis in production
- Configure SMTP and `SITE_URL` to your real domain
- Run `collectstatic` during deployment
- Domain in this project: `littlestarbank.com`

### Test-production deploy checklist (custom domain)

1) Prepare environment

- Copy `.env.prod` to your deployment environment and replace all `replace-with-...` placeholders.
- If using Docker Compose, keep database host as `db` in `DATABASE_URL`.
- If using a managed database, set the managed host in `DATABASE_URL`.

2) Build and start services

```powershell
cd C:\projects\star-bank
docker compose --env-file .env.prod up --build -d
```

3) Verify app health

```powershell
cd C:\projects\star-bank
docker compose ps
docker compose logs web --tail 100
```

- Public health endpoint: `GET /healthz/`
- Example: `https://littlestarbank.com/healthz/`

4) Configure reverse proxy / platform routing

- Terminate TLS (HTTPS) at your proxy/platform.
- Forward `X-Forwarded-Proto: https` so Django can enforce secure cookies and redirects.
- Route your domain to the web service/container.

5) DNS and certificate

- Point `A`/`CNAME` record(s) for `littlestarbank.com` and `www` to your host.
- Install a valid TLS certificate (Let's Encrypt or platform-managed cert).

6) Final smoke test

- Open login/register pages on your domain.
- Complete signup + activation flow.
- Check static assets load correctly.
- Hit `/healthz/` and confirm it returns `status: ok`.
- Trigger a background email task and confirm queue health in app settings.

## Where to deploy (with GoDaddy domain)

GoDaddy handles DNS only; deploy the app on a hosting platform and point DNS to it.

Recommended for fastest launch with this stack:

1. Render (web + worker + cron + managed Postgres + managed Redis)
2. Railway (web + worker + Postgres + Redis)
3. VPS (DigitalOcean/Linode/Hetzner) with Docker Compose if you want full control

Minimum DNS setup in GoDaddy:

- `A` record for `@` -> your host IP (or provider target)
- `CNAME` for `www` -> `littlestarbank.com`

After DNS is set, ensure these `.env.prod` values match:

- `DJANGO_ALLOWED_HOSTS=littlestarbank.com,www.littlestarbank.com`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://littlestarbank.com,https://www.littlestarbank.com`
- `SITE_URL=https://littlestarbank.com`

## Troubleshooting

- `failed to resolve host 'db'`: your local run is using Docker-only hostname. Replace with `127.0.0.1` or use SQLite fallback.
- Static changes not visible: run `uv run python manage.py collectstatic --noinput` and hard-refresh browser.
- Theme/API changes not persisting: verify `.env` points to expected DB and migrations are applied.

## Documentation policy

- `README.md` is the single source of project documentation in the repository root.
- Do not add more root-level Markdown files.
- If you need temporary notes or extended docs, keep them outside the repo root or in a separate working folder.
