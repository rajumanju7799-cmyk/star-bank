from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

from .health import healthz_view
from .pwa_views import manifest_view, service_worker_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('healthz/', healthz_view, name='healthz'),
    path('accounts/', include('apps.accounts.urls')),
    path('', include('apps.starbank.urls')),
    path('manifest.json', manifest_view, name='manifest'),
    path('service-worker.js', service_worker_view, name='service-worker'),
    path('favicon.ico', RedirectView.as_view(url='/static/images/favicon.png', permanent=True)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
