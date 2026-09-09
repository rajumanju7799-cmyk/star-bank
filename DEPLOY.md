# Star Bank – Production Deployment Guide

This guide walks you through deploying Star Bank to a Linux VPS (Ubuntu 22.04+)
with your own domain, Docker Compose, Nginx reverse-proxy, and a free Let's Encrypt SSL certificate.

---

## Architecture

```
Internet → Nginx (80/443) → Gunicorn (8000) → Django
                                             → PostgreSQL
                                             → Redis
                                             ← Celery worker + beat
```

---

## 1. Choose a VPS

Any provider works. Recommended entry-level options:

| Provider | Plan | ~Price/mo |
|----------|------|-----------|
| [Hetzner Cloud](https://hetzner.com/cloud) | CX22 (2 vCPU, 4 GB) | €4 |
| [DigitalOcean](https://digitalocean.com) | Basic Droplet (2 vCPU, 2 GB) | $12 |
| [Vultr](https://vultr.com) | Cloud Compute (2 vCPU, 2 GB) | $12 |

**Choose Ubuntu 22.04 LTS** when creating the server.

---

## 2. Point your domain to the server

In your domain registrar / DNS provider, add **two A records**:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `YOUR_SERVER_IP` |
| A | `www` | `YOUR_SERVER_IP` |

DNS propagation can take a few minutes to a few hours.

---

## 3. Initial server setup

SSH in as root, then run:

```bash
# Update packages
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install -y docker-compose-plugin

# Create a non-root deploy user (optional but recommended)
adduser deploy
usermod -aG docker deploy
```

---

## 4. Upload your project

From your **local machine** (Windows PowerShell):

```powershell
# Copy the project to the server (replace with your server IP)
scp -r C:\projects\star-bank root@YOUR_SERVER_IP:/opt/star-bank
```

Or use Git:

```bash
# On the server
git clone https://github.com/YOUR_USERNAME/star-bank.git /opt/star-bank
```

---

## 5. Create your production `.env` file

On the server:

```bash
cd /opt/star-bank
cp .env.prod .env
nano .env          # Review and update all values (see section 5a)
```

### 5a. Required environment variables

Edit `.env` with these values:

```dotenv
DJANGO_SETTINGS_MODULE=config.settings.production

# Generate a new secret key:  python -c "import secrets; print(secrets.token_urlsafe(50))"
DJANGO_SECRET_KEY=your-long-random-secret-key-here

DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=littlestarbank.com,www.littlestarbank.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://littlestarbank.com,https://www.littlestarbank.com
DJANGO_TIME_ZONE=UTC

# Database (Docker Compose internal hostname is "db")
DATABASE_URL=postgresql://starbank:STRONG_PASSWORD@db:5432/starbank
POSTGRES_DB=starbank
POSTGRES_USER=starbank
POSTGRES_PASSWORD=STRONG_PASSWORD          # Use a strong password here

# Celery / Redis (Docker Compose internal hostname is "redis")
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
CELERY_TASK_ALWAYS_EAGER=False

# Email (use SendGrid, Mailgun, Brevo, etc.)
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-smtp-api-key
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
DEFAULT_FROM_EMAIL=Star Bank <noreply@littlestarbank.com>

SITE_NAME=Star Bank
SITE_URL=https://littlestarbank.com
PARENT_PIN_SESSION_TIMEOUT_SECONDS=900

DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SECURE_HSTS_SECONDS=31536000

GUNICORN_WORKERS=3
GUNICORN_TIMEOUT=60
```

> ⚠️ **Security note:** Never commit `.env` to Git. It is already in `.gitignore`.

---

## 6. Obtain SSL certificate (Let's Encrypt)

The Nginx config requires the certificate to exist before it can start on port 443.
We use a temporary HTTP-only Nginx to pass the ACME challenge first.

```bash
cd /opt/star-bank

# 1. Start ONLY db, redis, and a temporary bare nginx so Certbot can reach port 80
docker compose -f docker-compose.prod.yml up -d db redis

# 2. Run Certbot in standalone mode (port 80 must be free)
docker run --rm -p 80:80 \
  -v /opt/star-bank/certbot_certs:/etc/letsencrypt \
  -v /opt/star-bank/certbot_webroot:/var/www/certbot \
  certbot/certbot certonly \
    --standalone \
    --email your@email.com \
    --agree-tos \
    --no-eff-email \
    -d littlestarbank.com \
    -d www.littlestarbank.com
```

After this succeeds you'll have certs in `/opt/star-bank/certbot_certs/live/littlestarbank.com/`.

---

## 7. Start everything

```bash
cd /opt/star-bank
docker compose -f docker-compose.prod.yml up -d --build
```

Check all containers are healthy:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f web
```

Visit **https://littlestarbank.com** — you should see the app with a green padlock.

---

## 8. Create a superuser

```bash
docker compose -f docker-compose.prod.yml exec web \
  python manage.py createsuperuser
```

---

## 9. Automatic SSL renewal

The `certbot` service in `docker-compose.prod.yml` runs `certbot renew` every 12 hours automatically. Nginx reloads after renewal via a cron job — add this on the server:

```bash
crontab -e
# Add this line:
0 3 * * * docker compose -f /opt/star-bank/docker-compose.prod.yml exec -T nginx nginx -s reload
```

---

## 10. Updating the app

```bash
cd /opt/star-bank
git pull                        # pull latest code
docker compose -f docker-compose.prod.yml up -d --build web worker beat
```

Migrations and `collectstatic` run automatically via `docker-entrypoint.sh`.

---

## 11. Useful commands

```bash
# View live logs
docker compose -f docker-compose.prod.yml logs -f

# Django shell
docker compose -f docker-compose.prod.yml exec web python manage.py shell

# Database backup
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U starbank starbank > backup_$(date +%Y%m%d).sql

# Restore backup
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U starbank starbank < backup_20260807.sql

# Stop everything
docker compose -f docker-compose.prod.yml down
```

---

## 12. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `502 Bad Gateway` | `web` container not ready yet — check `docker compose logs web` |
| `CSRF verification failed` | Ensure `DJANGO_CSRF_TRUSTED_ORIGINS` includes `https://yourdomain.com` |
| Static files 404 | Make sure `collectstatic` ran — check entrypoint logs |
| Email not sending | Verify SMTP credentials; check Celery worker logs |
| SSL cert not found | Re-run Certbot step in section 6 |

---

## Alternative: Railway (already configured in .env.prod)

Your `.env.prod` already has Railway PostgreSQL and Redis URLs.
If you prefer Railway's managed platform:

1. Install the Railway CLI: `npm install -g @railway/cli`
2. Run `railway login` then `railway link`
3. Set all env vars from `.env.prod` via `railway variables set KEY=value`
4. Deploy with `railway up`

Railway handles SSL and DNS automatically if you add your custom domain in the Railway dashboard under **Settings → Domains**.

