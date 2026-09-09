from django.urls import path

from . import views

app_name = 'accounts'

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('activation-sent/', views.activation_sent_view, name='activation-sent'),
    path('activate/<uidb64>/<token>/', views.activate_view, name='activate'),
    path('resend-activation/', views.resend_activation_view, name='resend-activation'),
]

