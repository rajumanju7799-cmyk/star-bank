from __future__ import annotations

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.templatetags.static import static


def manifest_view(request: HttpRequest) -> JsonResponse:
    app_name = settings.SITE_NAME
    manifest = {
        "name": f"{app_name} - Family Rewards",
        "short_name": app_name,
        "description": "Where little tasks become big rewards.",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "orientation": "portrait-primary",
        "background_color": "#ffffff",
        "theme_color": "#f59e0b",
        "icons": [
            {
                "src": static("images/logo.svg"),
                "sizes": "any",
                "type": "image/svg+xml",
                "purpose": "any maskable",
            }
        ],
    }
    return JsonResponse(manifest)


def service_worker_view(request: HttpRequest) -> HttpResponse:
    script = """
const CACHE_NAME = 'little-starts-bank-v1';
const APP_SHELL = [
  '/',
  '/accounts/login/',
  '/manifest.json',
  '/static/css/app.css',
  '/static/images/logo.svg',
  '/static/images/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('', { status: 504, statusText: 'Offline' });
        })
      )
  );
});
""".strip()
    return HttpResponse(script, content_type="application/javascript")

