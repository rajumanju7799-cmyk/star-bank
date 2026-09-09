from __future__ import annotations

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from config.celery import app
from .models import User
from .tokens import account_activation_token


@app.task(name='apps.accounts.send_activation_email')
def send_activation_email_task(user_id: int, site_url: str = None) -> dict:
    """
    Send account activation email asynchronously.

    Args:
        user_id: The ID of the user to send activation email to
        site_url: Optional custom site URL (defaults to settings.SITE_URL)

    Returns:
        Dict with 'success' and 'message' keys
    """
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return {'success': False, 'message': 'User not found'}

    site_url = site_url or settings.SITE_URL
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = account_activation_token.make_token(user)
    activation_url = site_url + reverse('accounts:activate', kwargs={'uidb64': uid, 'token': token})

    context = {
        'user': user,
        'activation_url': activation_url,
        'site_name': settings.SITE_NAME,
    }

    try:
        text_body = render_to_string('emails/activation_email.txt', context)
        html_body = render_to_string('emails/activation_email.html', context)
        message = EmailMultiAlternatives(
            subject='Activate your Little Starts Bank account',
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        message.attach_alternative(html_body, 'text/html')
        sent_count = message.send(fail_silently=False)
        if sent_count < 1:
            return {'success': False, 'message': 'SMTP backend accepted 0 activation emails'}
        return {'success': True, 'message': 'Activation email sent'}
    except Exception as e:
        return {'success': False, 'message': f'Failed to send activation email: {str(e)}'}

