from django.urls import path

from . import views

app_name = 'starbank'

urlpatterns = [
    path('', views.home_view, name='home'),
    path('parent/pin/', views.parent_pin_view, name='parent-pin'),
    path('parent/dashboard/', views.parent_dashboard_view, name='parent-dashboard'),
    path('parent/reports/', views.reports_view, name='reports'),
    path('settings/', views.settings_view, name='settings'),
    path('settings/email-queue-health/', views.email_queue_health_view, name='email-queue-health'),
    path('settings/set-theme/', views.set_theme_view, name='set-theme'),
    path('kid/', views.kid_dashboard_view, name='kid-dashboard'),
    path('tasks/add/', views.add_daily_task_view, name='add-daily-task'),
    path('tasks/<int:task_id>/complete/', views.complete_daily_task_view, name='complete-daily-task'),
    path('tasks/<int:task_id>/delete/', views.delete_daily_task_view, name='delete-daily-task'),
    path('stars/subtract/', views.subtract_stars_view, name='subtract-stars'),
    path('withdrawals/request/', views.request_withdrawal_view, name='request-withdrawal'),
    path('withdrawals/<int:pk>/<str:action>/', views.review_withdrawal_view, name='review-withdrawal'),
]

