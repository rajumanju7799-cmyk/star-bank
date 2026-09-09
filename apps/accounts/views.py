from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.http import require_POST

from apps.starbank.services import bootstrap_family_account

from .forms import EmailLoginForm, RegistrationForm
from .models import User
from .tasks import send_activation_email_task
from .tokens import account_activation_token


def _queue_activation_email(user_id: int) -> bool:
    """Queue activation email without blocking the request on broker retries."""
    try:
        send_activation_email_task.apply_async(
            args=[user_id],
            retry=False,
            ignore_result=True,
        )
        return True
    except Exception:
        # Never block account flows if queue infrastructure is down.
        return False


def register_view(request):
    if request.user.is_authenticated:
        return redirect('starbank:home')

    form = RegistrationForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        user = form.save(commit=False)
        user.is_active = False
        user.save()
        queued = _queue_activation_email(user.id)
        if not queued:
            messages.warning(request, 'Account created, but email queue is unavailable right now. Please try resend activation in a minute.')
        request.session['activation_email'] = user.email
        return redirect('accounts:activation-sent')

    if request.method == 'POST' and not form.is_valid():
        email = (request.POST.get('email') or '').strip().lower()
        if email:
            existing_user = User.objects.filter(email=email, is_active=False).first()
            if existing_user:
                queued = _queue_activation_email(existing_user.id)
                request.session['activation_email'] = existing_user.email
                if queued:
                    messages.info(request, 'This email is already registered but not activated. We queued a fresh activation email.')
                else:
                    messages.warning(request, 'This email is already registered but not activated. Email queue is unavailable, so we could not queue a resend yet.')
                return redirect('accounts:activation-sent')

    return render(request, 'accounts/register.html', {'form': form})


def activation_sent_view(request):
    return render(request, 'accounts/activation_sent.html', {'email': request.session.get('activation_email')})


def activate_view(request, uidb64: str, token: str):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user and account_activation_token.check_token(user, token):
        user.is_active = True
        user.save(update_fields=['is_active'])
        bootstrap_family_account(user)
        messages.success(request, 'Your email is verified. Welcome to Little Starts Bank!')
        return redirect('accounts:login')

    return render(request, 'accounts/activation_invalid.html', status=400)


def login_view(request):
    if request.user.is_authenticated:
        return redirect('starbank:home')

    form = EmailLoginForm(request.POST or None, request=request)
    if request.method == 'POST' and form.is_valid():
        user = form.get_user()
        login(request, user)
        request.session['parent_verified'] = False
        bootstrap_family_account(user)
        messages.success(request, f'Welcome back, {user.display_name}!')
        return redirect('starbank:home')

    return render(request, 'accounts/login.html', {'form': form})


@login_required
def logout_view(request):
    logout(request)
    messages.info(request, 'You have been signed out.')
    return redirect('accounts:login')


@require_POST
def resend_activation_view(request):
    email = request.POST.get('email', '').strip().lower()
    if not email:
        messages.error(request, 'Please enter your account email first.')
        return redirect('accounts:login')

    try:
        user = User.objects.get(email=email, is_active=False)
    except User.DoesNotExist:
        messages.error(request, 'No inactive account found for that email.')
        return redirect('accounts:login')

    queued = _queue_activation_email(user.id)

    request.session['activation_email'] = user.email
    if queued:
        messages.success(request, 'Activation email queued. Please check your inbox and spam folder shortly.')
    else:
        messages.warning(request, 'Could not queue activation email right now. Please try again in a minute.')
    return redirect('accounts:login')

