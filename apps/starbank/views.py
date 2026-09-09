from __future__ import annotations

from datetime import date, datetime, timedelta

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .forms import (
    DailyTaskForm,
    FamilySettingsForm,
    KidProfileForm,
    ParentPinForm,
    SavingsGoalForm,
    StarAdjustmentForm,
    TaskTemplateForm,
    WithdrawalRequestForm,
)
from .models import THEME_CHOICES, DailyTask, KidProfile, WithdrawalRequest
from .services import (
    add_custom_daily_task,
    bootstrap_family_account,
    complete_task,
    ensure_daily_tasks,
    get_email_queue_health,
    get_account_balance,
    get_monthly_report,
    get_today_star_total,
    get_total_star_count,
    get_weekly_report,
    subtract_stars,
)


def _parse_month_value(raw_value: str | None, fallback: date) -> date:
    if not raw_value:
        return fallback.replace(day=1)
    try:
        return datetime.strptime(raw_value, '%Y-%m').date().replace(day=1)
    except ValueError:
        return fallback.replace(day=1)


def _parse_day_value(raw_value: str | None, fallback: date, month_anchor: date) -> date:
    if not raw_value:
        return fallback if (fallback.year == month_anchor.year and fallback.month == month_anchor.month) else month_anchor
    try:
        parsed = datetime.strptime(raw_value, '%Y-%m-%d').date()
    except ValueError:
        return fallback if (fallback.year == month_anchor.year and fallback.month == month_anchor.month) else month_anchor
    if parsed.year != month_anchor.year or parsed.month != month_anchor.month:
        return fallback if (fallback.year == month_anchor.year and fallback.month == month_anchor.month) else month_anchor
    return parsed


def _star_mood(stars: int) -> tuple[str, str]:
    if stars >= 8:
        return 'Super star day!', '🚀'
    if stars >= 5:
        return 'Great progress!', '🌈'
    if stars >= 2:
        return 'Nice effort!', '✨'
    if stars == 1:
        return 'Good start!', '🙂'
    return 'Rest and recharge day', '😴'


def _build_report_context(kid: KidProfile, today: date, month_anchor: date, selected_day: date) -> dict:
    weekly_report = get_weekly_report(kid)
    monthly_report = get_monthly_report(kid, month_anchor)
    month_start = month_anchor.replace(day=1)
    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

    month_completed_tasks = (
        DailyTask.objects.filter(
            kid=kid,
            date__gte=month_start,
            date__lt=next_month,
            completed_at__isnull=False,
        )
        .order_by('date', 'completed_at', 'name')
    )
    month_adjustments = (
        kid.star_adjustments.filter(
            date__gte=month_start,
            date__lt=next_month,
        )
        .order_by('date', 'created_at')
    )

    earned_by_day: dict[date, int] = {}
    tasks_by_day: dict[date, list] = {}
    for task in month_completed_tasks:
        earned_by_day[task.date] = earned_by_day.get(task.date, 0) + task.stars
        tasks_by_day.setdefault(task.date, []).append(task)

    deducted_by_day: dict[date, int] = {}
    adjustments_by_day: dict[date, list] = {}
    for adjustment in month_adjustments:
        deducted_by_day[adjustment.date] = deducted_by_day.get(adjustment.date, 0) + adjustment.stars
        adjustments_by_day.setdefault(adjustment.date, []).append(adjustment)

    weekly_entries = []
    for report_date, stars in weekly_report.items():
        mood_text, mood_emoji = _star_mood(stars)
        weekly_entries.append(
            {
                'date': report_date,
                'stars': stars,
                'progress': min(100, stars * 10),
                'mood_text': mood_text,
                'mood_emoji': mood_emoji,
                'is_today': report_date == today,
            }
        )

    daily_entries = []
    for days_ago in range(0, 14):
        report_date = today - timedelta(days=days_ago)
        stars = get_today_star_total(kid, report_date)
        mood_text, mood_emoji = _star_mood(stars)
        daily_entries.append(
            {
                'date': report_date,
                'stars': stars,
                'progress': min(100, stars * 10),
                'mood_text': mood_text,
                'mood_emoji': mood_emoji,
                'is_today': report_date == today,
            }
        )

    monthly_entries = []
    for report_date, stars in monthly_report.items():
        mood_text, mood_emoji = _star_mood(stars)
        if stars == 0:
            tone_class = 'report-day--none'
        elif stars <= 3:
            tone_class = 'report-day--low'
        elif stars <= 6:
            tone_class = 'report-day--mid'
        else:
            tone_class = 'report-day--high'

        monthly_entries.append(
            {
                'date': report_date,
                'day': report_date.day,
                'stars': stars,
                'earned': earned_by_day.get(report_date, 0),
                'deducted': deducted_by_day.get(report_date, 0),
                'task_count': len(tasks_by_day.get(report_date, [])),
                'mood_text': mood_text,
                'mood_emoji': mood_emoji,
                'tone_class': tone_class,
                'is_selected': report_date == selected_day,
            }
        )

    weekly_total = sum(item['stars'] for item in weekly_entries)
    monthly_total = sum(item['stars'] for item in monthly_entries)
    active_days_this_month = sum(1 for item in monthly_entries if item['stars'] > 0)

    best_week_day = max(weekly_entries, key=lambda item: item['stars'], default=None)
    best_month_day = max(monthly_entries, key=lambda item: item['stars'], default=None)

    current_streak = 0
    for days_ago in range(0, 180):
        streak_day = today - timedelta(days=days_ago)
        if get_today_star_total(kid, streak_day) > 0:
            current_streak += 1
        else:
            break

    best_recent_streak = 0
    streak_run = 0
    for item in reversed(daily_entries):
        if item['stars'] > 0:
            streak_run += 1
            best_recent_streak = max(best_recent_streak, streak_run)
        else:
            streak_run = 0

    prev_month = (month_anchor - timedelta(days=1)).replace(day=1)
    following_month = (month_anchor.replace(day=28) + timedelta(days=4)).replace(day=1)

    selected_day_tasks = tasks_by_day.get(selected_day, [])
    selected_day_adjustments = adjustments_by_day.get(selected_day, [])
    selected_day_summary = {
        'date': selected_day,
        'stars': max(0, earned_by_day.get(selected_day, 0) - deducted_by_day.get(selected_day, 0)),
        'earned': earned_by_day.get(selected_day, 0),
        'deducted': deducted_by_day.get(selected_day, 0),
        'task_count': len(selected_day_tasks),
    }

    # Build a true calendar grid with leading/trailing placeholders.
    month_grid = []
    leading_slots = month_start.weekday()  # Monday=0
    for _ in range(leading_slots):
        month_grid.append(None)
    month_grid.extend(monthly_entries)
    while len(month_grid) % 7 != 0:
        month_grid.append(None)

    calendar_weeks = [month_grid[i:i + 7] for i in range(0, len(month_grid), 7)]

    week_rows = []
    for week_index, week in enumerate(calendar_weeks, start=1):
        week_total = sum(item['stars'] for item in week if item)
        week_rows.append({'label': f'Week {week_index}', 'total': week_total})
    max_week_total = max((row['total'] for row in week_rows), default=0)
    for row in week_rows:
        row['progress'] = int((row['total'] / max_week_total) * 100) if max_week_total else 0

    previous_month_total = sum(get_monthly_report(kid, prev_month_start).values())
    month_delta = monthly_total - previous_month_total
    if previous_month_total:
        month_delta_percent = round((month_delta / previous_month_total) * 100, 1)
    else:
        month_delta_percent = 100.0 if monthly_total > 0 else 0.0

    selected_day_star_total = int(selected_day_summary['stars'])
    selected_day_star_icons = min(8, selected_day_star_total)
    selected_day_extra_stars = max(0, selected_day_star_total - selected_day_star_icons)

    return {
        'weekly_report': weekly_report,
        'monthly_report': monthly_report,
        'weekly_entries': weekly_entries,
        'daily_entries': daily_entries,
        'monthly_entries': monthly_entries,
        'weekly_total': weekly_total,
        'weekly_average': round(weekly_total / 7, 1),
        'monthly_total': monthly_total,
        'active_days_this_month': active_days_this_month,
        'best_week_day': best_week_day,
        'best_month_day': best_month_day,
        'current_streak': current_streak,
        'best_recent_streak': best_recent_streak,
        'report_month_value': month_anchor.strftime('%Y-%m'),
        'report_month_label': month_anchor.strftime('%B %Y'),
        'report_prev_month_value': prev_month.strftime('%Y-%m'),
        'report_next_month_value': following_month.strftime('%Y-%m'),
        'report_selected_day_value': selected_day.strftime('%Y-%m-%d'),
        'calendar_weeks': calendar_weeks,
        'selected_day_summary': selected_day_summary,
        'selected_day_tasks': selected_day_tasks,
        'selected_day_adjustments': selected_day_adjustments,
        'selected_day_star_icons': range(selected_day_star_icons),
        'selected_day_extra_stars': selected_day_extra_stars,
        'month_week_rows': week_rows,
        'previous_month_label': prev_month_start.strftime('%B %Y'),
        'previous_month_total': previous_month_total,
        'month_delta': month_delta,
        'month_delta_percent': month_delta_percent,
    }


def get_selected_kid(request: HttpRequest) -> KidProfile:
    bootstrap_family_account(request.user)
    kids = request.user.kids.all().order_by('name')
    requested = request.GET.get('kid') or request.POST.get('kid') or request.session.get('selected_kid_id')
    kid = kids.filter(id=requested).first() if requested else None
    if kid is None:
        kid = kids.first()
    if kid is None:
        raise PermissionDenied('No kid profiles available.')
    request.session['selected_kid_id'] = kid.id
    return kid


def require_parent_verified(view_func):
    def wrapped(request: HttpRequest, *args, **kwargs):
        timeout_seconds = int(getattr(settings, 'PARENT_PIN_SESSION_TIMEOUT_SECONDS', 900))
        if request.session.get('parent_verified', False) and not request.session.get('parent_verified_at'):
            request.session['parent_verified_at'] = timezone.now().timestamp()
        verified_at = request.session.get('parent_verified_at')
        is_stale = not verified_at or (timezone.now().timestamp() - verified_at) > timeout_seconds
        if not request.session.get('parent_verified', False) or is_stale:
            request.session['parent_verified'] = False
            messages.info(request, 'Please enter the parent PIN to continue.')
            return redirect('starbank:parent-pin')
        return view_func(request, *args, **kwargs)

    return login_required(wrapped)


@login_required
def home_view(request: HttpRequest) -> HttpResponse:
    bootstrap_family_account(request.user)
    return render(request, 'starbank/home.html')


@login_required
def parent_pin_view(request: HttpRequest) -> HttpResponse:
    family_settings = request.user.family_settings
    form = ParentPinForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        if family_settings.verify_parent_pin(form.cleaned_data['pin']):
            request.session['parent_verified'] = True
            request.session['parent_verified_at'] = timezone.now().timestamp()
            messages.success(request, 'Parent mode unlocked.')
            return redirect('starbank:parent-dashboard')
        messages.error(request, 'Incorrect PIN. Please try again.')
    return render(request, 'starbank/parent_pin.html', {'form': form})


@require_parent_verified
def parent_dashboard_view(request: HttpRequest) -> HttpResponse:
    kid = get_selected_kid(request)
    family_settings = request.user.family_settings
    today = timezone.localdate()
    today_tasks = ensure_daily_tasks(kid, today)
    context = {
        'selected_kid': kid,
        'today_tasks': today_tasks,
        'today_stars': get_today_star_total(kid, today),
        'total_stars': get_total_star_count(kid),
        'daily_limit': family_settings.daily_star_limit,
        'pending_requests': kid.withdrawal_requests.filter(status='pending')[:5],
        'all_requests': kid.withdrawal_requests.order_by('-created_at')[:20],
        'add_task_form': DailyTaskForm(),
        'subtract_form': StarAdjustmentForm(),
        'kids': request.user.kids.all(),
    }
    return render(request, 'starbank/parent_dashboard.html', context)


@login_required
def kid_dashboard_view(request: HttpRequest) -> HttpResponse:
    # Enforce a fresh PIN check when moving back from kid mode to parent mode.
    request.session['parent_verified'] = False
    kid = get_selected_kid(request)
    family_settings = request.user.family_settings
    today = timezone.localdate()
    month_anchor = _parse_month_value(request.GET.get('month'), today)
    selected_day = _parse_day_value(request.GET.get('day'), today, month_anchor)
    today_tasks = list(ensure_daily_tasks(kid, today))
    completed = [task for task in today_tasks if task.is_completed]
    pending = [task for task in today_tasks if not task.is_completed]
    context = {
        'selected_kid': kid,
        'kids': request.user.kids.all(),
        'today_stars': get_today_star_total(kid, today),
        'total_stars': get_total_star_count(kid),
        'daily_limit': family_settings.daily_star_limit,
        'completed_today': completed,
        'pending_today': pending,
        'history': kid.daily_tasks.order_by('-date', 'name')[:20],
        'balance': get_account_balance(kid, family_settings),
        'goals': kid.savings_goals.all(),
        'withdrawal_form': WithdrawalRequestForm(),
        'withdrawal_requests': kid.withdrawal_requests.order_by('-created_at'),
    }
    context.update(_build_report_context(kid, today=today, month_anchor=month_anchor, selected_day=selected_day))
    return render(request, 'starbank/kid_dashboard.html', context)


@require_parent_verified
@require_POST
def add_daily_task_view(request: HttpRequest) -> HttpResponse:
    kid = get_selected_kid(request)
    form = DailyTaskForm(request.POST)
    if form.is_valid():
        try:
            add_custom_daily_task(kid, form.cleaned_data['name'], form.cleaned_data['stars'])
            messages.success(request, 'New task added for today.')
        except IntegrityError:
            messages.error(request, 'A task of this type already exists today.')
    else:
        messages.error(request, 'Please enter a valid task name and star value.')
    return redirect(f"{reverse('starbank:parent-dashboard')}?kid={kid.id}")


@require_parent_verified
@require_POST
def complete_daily_task_view(request: HttpRequest, task_id: int) -> HttpResponse:
    task = get_object_or_404(DailyTask, id=task_id, kid__user=request.user)
    success, message = complete_task(task, request.user.family_settings)
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': success, 'message': message, 'task_id': task.id})
    messages.success(request, message) if success else messages.error(request, message)
    return redirect(f"{reverse('starbank:parent-dashboard')}?kid={task.kid_id}")


@require_parent_verified
@require_POST
def delete_daily_task_view(request: HttpRequest, task_id: int) -> HttpResponse:
    task = get_object_or_404(DailyTask, id=task_id, kid__user=request.user)
    kid_id = task.kid_id
    task.delete()
    messages.info(request, 'Task removed.')
    return redirect(f"{reverse('starbank:parent-dashboard')}?kid={kid_id}")


@require_parent_verified
@require_POST
def subtract_stars_view(request: HttpRequest) -> HttpResponse:
    kid = get_selected_kid(request)
    form = StarAdjustmentForm(request.POST)
    if form.is_valid():
        subtract_stars(kid, form.cleaned_data['stars'], form.cleaned_data['reason'])
        messages.success(request, 'Stars deducted successfully.')
    else:
        messages.error(request, 'Enter a valid deduction and reason.')
    return redirect(f"{reverse('starbank:parent-dashboard')}?kid={kid.id}")


@login_required
@require_POST
def request_withdrawal_view(request: HttpRequest) -> HttpResponse:
    kid = get_selected_kid(request)
    form = WithdrawalRequestForm(request.POST)
    if form.is_valid():
        balance = get_account_balance(kid, request.user.family_settings)['available_balance']
        requested = form.cleaned_data['amount']
        if balance <= 0:
            messages.error(request, 'You do not have available balance yet. Complete tasks to earn stars first.')
        elif requested > balance:
            messages.error(request, f'Request amount must be less than or equal to available balance (${balance}).')
        else:
            withdrawal = form.save(commit=False)
            withdrawal.kid = kid
            withdrawal.save()
            messages.success(request, 'Withdrawal request sent to parent.')
    else:
        messages.error(request, 'Please complete the request form.')
    return redirect(f"{reverse('starbank:kid-dashboard')}?kid={kid.id}")


@require_parent_verified
@require_POST
def review_withdrawal_view(request: HttpRequest, pk: int, action: str) -> HttpResponse:
    withdrawal = get_object_or_404(WithdrawalRequest, pk=pk, kid__user=request.user)
    if action not in {'approve', 'reject'}:
        raise PermissionDenied('Unsupported action')
    withdrawal.status = 'approved' if action == 'approve' else 'rejected'
    if action == 'approve':
        withdrawal.approved_amount = withdrawal.amount
    withdrawal.comments = request.POST.get('comments', '')
    withdrawal.save(update_fields=['status', 'approved_amount', 'comments'])
    messages.success(request, f'Withdrawal request {withdrawal.status}.')
    return redirect(f"{reverse('starbank:parent-dashboard')}?kid={withdrawal.kid_id}")


@require_parent_verified
def reports_view(request: HttpRequest) -> HttpResponse:
    kid = get_selected_kid(request)
    today = timezone.localdate()
    month_anchor = _parse_month_value(request.GET.get('month'), today)
    selected_day = _parse_day_value(request.GET.get('day'), today, month_anchor)
    context = {
        'selected_kid': kid,
        'kids': request.user.kids.all(),
    }
    context.update(_build_report_context(kid, today=today, month_anchor=month_anchor, selected_day=selected_day))
    return render(request, 'starbank/reports.html', context)


@require_parent_verified
def settings_view(request: HttpRequest) -> HttpResponse:
    bootstrap_family_account(request.user)
    selected_kid = get_selected_kid(request)
    family_settings = request.user.family_settings
    settings_form = FamilySettingsForm(request.POST or None, instance=family_settings, prefix='settings')
    kid_form = KidProfileForm(request.POST or None, prefix='kid')
    edit_kid_form = KidProfileForm(request.POST or None, instance=selected_kid, prefix='edit-kid')
    task_form = TaskTemplateForm(request.POST or None, prefix='task')
    goal_form = SavingsGoalForm(request.POST or None, prefix='goal')

    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'save-settings' and settings_form.is_valid():
            settings_form.save()
            messages.success(request, 'Family settings saved.')
            return redirect('starbank:settings')

        if action == 'add-kid' and kid_form.is_valid():
            kid = kid_form.save(commit=False)
            kid.user = request.user
            kid.save()
            ensure_daily_tasks(kid)
            messages.success(request, 'Kid profile added.')
            return redirect('starbank:settings')

        if action == 'quick-edit-kid':
            kid_id = request.POST.get('kid_id')
            kid = get_object_or_404(KidProfile, id=kid_id, user=request.user)
            kid.name = (request.POST.get('name') or kid.name).strip() or kid.name
            kid.avatar_emoji = (request.POST.get('avatar_emoji') or kid.avatar_emoji).strip() or kid.avatar_emoji
            kid.save(update_fields=['name', 'avatar_emoji'])
            messages.success(request, f'{kid.name} profile updated.')
            return redirect(f"{reverse('starbank:settings')}?kid={kid.id}")

        if action == 'edit-kid' and edit_kid_form.is_valid():
            edit_kid_form.save()
            messages.success(request, 'Kid profile updated.')
            return redirect(f"{reverse('starbank:settings')}?kid={selected_kid.id}")

        if action == 'add-template' and task_form.is_valid():
            template = task_form.save(commit=False)
            template.user = request.user
            template.sort_order = request.user.task_templates.count() + 1
            try:
                template.save()
            except ValidationError:
                messages.error(request, 'A similar task already exists.')
            except IntegrityError:
                messages.error(request, 'A similar task already exists.')
            else:
                for kid in request.user.kids.all():
                    ensure_daily_tasks(kid)
                messages.success(request, 'Default task added.')
            return redirect('starbank:settings')

        if action == 'add-goal' and goal_form.is_valid():
            kid = get_selected_kid(request)
            goal = goal_form.save(commit=False)
            goal.kid = kid
            goal.save()
            messages.success(request, 'Savings goal added.')
            return redirect(f"{reverse('starbank:settings')}?kid={kid.id}")

    context = {
        'settings_form': settings_form,
        'kid_form': kid_form,
        'edit_kid_form': edit_kid_form,
        'task_form': task_form,
        'goal_form': goal_form,
        'kids': request.user.kids.all(),
        'templates': request.user.task_templates.filter(is_active=True),
        'selected_kid': selected_kid,
    }
    return render(request, 'starbank/settings.html', context)


@login_required
@require_POST
def set_theme_view(request: HttpRequest) -> JsonResponse:
    """AJAX endpoint: save chosen theme and return new theme name."""
    theme = request.POST.get('theme', '').strip()
    valid_themes = {key for key, _ in THEME_CHOICES}
    if theme not in valid_themes:
        return JsonResponse({'ok': False, 'error': 'Invalid theme.'}, status=400)
    fs = request.user.family_settings
    fs.theme = theme
    fs.save(update_fields=['theme', 'updated_at'])
    return JsonResponse({'ok': True, 'theme': theme})


@login_required
def email_queue_health_view(request: HttpRequest) -> JsonResponse:
    force_refresh = request.GET.get('refresh') == '1'
    return JsonResponse(get_email_queue_health(force_refresh=force_refresh))


