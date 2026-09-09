from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import User
from .tasks import send_activation_email_task


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    SITE_URL='http://testserver',
    SECURE_SSL_REDIRECT=False,
    CELERY_TASK_ALWAYS_EAGER=True,
)
class AccountFlowTests(TestCase):
    def test_registration_sends_activation_email_and_creates_inactive_user(self):
        response = self.client.post(
            reverse('accounts:register'),
            {
                'display_name': 'Star Family',
                'email': 'family@example.com',
                'password1': 'StrongPass123!',
                'password2': 'StrongPass123!',
            },
        )
        self.assertIn(response.status_code, {301, 302})
        user = User.objects.get(email='family@example.com')
        self.assertFalse(user.is_active)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Activate your Little Starts Bank account', mail.outbox[0].subject)

    def test_resend_activation_works_without_login(self):
        user = User.objects.create_user(email='pending@example.com', password='StrongPass123!', is_active=False)

        response = self.client.post(
            reverse('accounts:resend-activation'),
            {'email': user.email},
        )

        self.assertIn(response.status_code, {301, 302})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [user.email])

    def test_registering_existing_inactive_email_resends_activation(self):
        User.objects.create_user(email='inactive@example.com', password='StrongPass123!', is_active=False)

        response = self.client.post(
            reverse('accounts:register'),
            {
                'display_name': 'Family',
                'email': 'inactive@example.com',
                'password1': 'StrongPass123!',
                'password2': 'StrongPass123!',
            },
        )

        self.assertIn(response.status_code, {301, 302})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(User.objects.filter(email='inactive@example.com').count(), 1)


@override_settings(SITE_URL='http://testserver')
class ActivationTaskTests(TestCase):
    def test_task_returns_failure_when_backend_accepts_zero_messages(self):
        user = User.objects.create_user(email='task-zero@example.com', password='StrongPass123!', is_active=False)
        with patch('apps.accounts.tasks.EmailMultiAlternatives.send', return_value=0):
            result = send_activation_email_task(user.id)
        self.assertFalse(result['success'])

    def test_task_returns_failure_when_smtp_raises(self):
        user = User.objects.create_user(email='task-timeout@example.com', password='StrongPass123!', is_active=False)
        with patch('apps.accounts.tasks.EmailMultiAlternatives.send', side_effect=TimeoutError('timed out')):
            result = send_activation_email_task(user.id)
        self.assertFalse(result['success'])


