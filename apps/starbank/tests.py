from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from .models import DailyTask
from .services import bootstrap_family_account, ensure_daily_tasks, get_today_star_total

User = get_user_model()


class StarBankServiceTests(TestCase):
    def test_bootstrap_creates_default_family_data(self):
        user = User.objects.create_user(email='family@example.com', password='StrongPass123!', is_active=True)
        bootstrap_family_account(user)
        self.assertTrue(hasattr(user, 'family_settings'))
        self.assertEqual(user.kids.count(), 1)
        self.assertGreater(user.task_templates.count(), 0)

    def test_ensure_daily_tasks_syncs_templates_and_today_totals(self):
        user = User.objects.create_user(email='family2@example.com', password='StrongPass123!', is_active=True)
        bootstrap_family_account(user)
        kid = user.kids.first()
        tasks = ensure_daily_tasks(kid)
        self.assertGreater(tasks.count(), 0)
        task = DailyTask.objects.filter(kid=kid).first()
        task.completed_at = timezone.now()
        task.save(update_fields=['completed_at'])
        self.assertGreaterEqual(get_today_star_total(kid), task.stars)


class ParentPinSecurityTests(TestCase):
    def test_bootstrapped_parent_pin_is_hashed_and_can_be_verified(self):
        user = User.objects.create_user(email='pinhash@example.com', password='StrongPass123!', is_active=True)
        bootstrap_family_account(user)
        family_settings = user.family_settings

        self.assertNotEqual(family_settings.parent_pin, '1234')
        self.assertTrue(family_settings.verify_parent_pin('1234'))

    @override_settings(PARENT_PIN_SESSION_TIMEOUT_SECONDS=0)
    def test_parent_verification_times_out(self):
        user = User.objects.create_user(email='pintimeout@example.com', password='StrongPass123!', is_active=True)
        bootstrap_family_account(user)
        kid = user.kids.first()

        self.client.force_login(user)
        session = self.client.session
        session['parent_verified'] = True
        session['parent_verified_at'] = 0
        session['selected_kid_id'] = kid.id
        session.save()

        response = self.client.get(reverse('starbank:parent-dashboard') + f'?kid={kid.id}')
        self.assertIn(response.status_code, {301, 302})
        self.assertIn(reverse('starbank:parent-pin'), response.url)


class EmailQueueHealthViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='status@example.com', password='StrongPass123!', is_active=True)

    def test_requires_authentication(self):
        response = self.client.get(reverse('starbank:email-queue-health'))
        self.assertIn(response.status_code, {301, 302})

    @patch('apps.starbank.services.Connection')
    def test_returns_healthy_status_when_broker_is_reachable(self, connection_cls):
        self.client.force_login(self.user)
        response = self.client.get(reverse('starbank:email-queue-health') + '?refresh=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'healthy')
        connection_cls.return_value.connect.assert_called_once()

    @patch('apps.starbank.services.Connection')
    def test_returns_degraded_status_when_broker_is_unreachable(self, connection_cls):
        self.client.force_login(self.user)
        connection_cls.return_value.connect.side_effect = OSError('unreachable')
        response = self.client.get(reverse('starbank:email-queue-health') + '?refresh=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'degraded')


class SettingsKidEditTests(TestCase):
    def test_can_edit_selected_kid_name_from_settings(self):
        user = User.objects.create_user(email='editkid@example.com', password='StrongPass123!', is_active=True)
        bootstrap_family_account(user)
        kid = user.kids.first()

        session = self.client.session
        session['parent_verified'] = True
        session['selected_kid_id'] = kid.id
        session.save()

        self.client.force_login(user)
        response = self.client.post(
            reverse('starbank:settings') + f'?kid={kid.id}',
            {
                'action': 'edit-kid',
                'kid': str(kid.id),
                'edit-kid-name': 'Kiyu',
                'edit-kid-avatar_emoji': '⭐',
            },
        )

        self.assertIn(response.status_code, {301, 302})
        kid.refresh_from_db()
        self.assertEqual(kid.name, 'Kiyu')

    def test_can_edit_any_kid_name_from_settings_list(self):
        user = User.objects.create_user(email='editanykid@example.com', password='StrongPass123!', is_active=True)
        bootstrap_family_account(user)
        selected_kid = user.kids.first()
        other_kid = user.kids.create(name='Anvi', avatar_emoji='🌟')

        session = self.client.session
        session['parent_verified'] = True
        session['selected_kid_id'] = selected_kid.id
        session.save()

        self.client.force_login(user)
        response = self.client.post(
            reverse('starbank:settings') + f'?kid={selected_kid.id}',
            {
                'action': 'quick-edit-kid',
                'kid_id': str(other_kid.id),
                'name': 'Anvi Updated',
                'avatar_emoji': '🚀',
            },
        )

        self.assertIn(response.status_code, {301, 302})
        other_kid.refresh_from_db()
        self.assertEqual(other_kid.name, 'Anvi Updated')
        self.assertEqual(other_kid.avatar_emoji, '🚀')


class WithdrawalRequestRulesTests(TestCase):
    def test_kid_cannot_request_withdrawal_above_available_balance(self):
        user = User.objects.create_user(email='withdrawal@example.com', password='StrongPass123!', is_active=True)
        bootstrap_family_account(user)
        kid = user.kids.first()

        self.client.force_login(user)
        response = self.client.post(
            reverse('starbank:request-withdrawal') + f'?kid={kid.id}',
            {
                'kid': str(kid.id),
                'amount': '1.00',
                'category': 'save',
                'description': 'Toy request',
            },
            follow=True,
        )

        self.assertContains(response, 'available balance', status_code=200)
        self.assertEqual(kid.withdrawal_requests.count(), 0)

    def test_kid_and_parent_views_show_request_statuses_with_timestamps(self):
        user = User.objects.create_user(email='withdrawal2@example.com', password='StrongPass123!', is_active=True)
        bootstrap_family_account(user)
        kid = user.kids.first()
        kid.withdrawal_requests.create(amount='5.00', category='save', description='Goal save', status='approved')
        kid.withdrawal_requests.create(amount='3.00', category='spend', description='Snacks', status='rejected')

        self.client.force_login(user)
        kid_response = self.client.get(reverse('starbank:kid-dashboard') + f'?kid={kid.id}')
        self.assertContains(kid_response, 'Approved', status_code=200)
        self.assertContains(kid_response, 'Rejected', status_code=200)
        self.assertContains(kid_response, 'Requested on', status_code=200)

        session = self.client.session
        session['parent_verified'] = True
        session['selected_kid_id'] = kid.id
        session.save()
        parent_response = self.client.get(reverse('starbank:parent-dashboard') + f'?kid={kid.id}')
        self.assertContains(parent_response, 'Approved', status_code=200)
        self.assertContains(parent_response, 'Rejected', status_code=200)
        self.assertContains(parent_response, 'Requested on', status_code=200)



class ParentReportsTopControlTests(TestCase):
    def test_reports_page_uses_top_control_bar_and_no_sidebar(self):
        user = User.objects.create_user(email='parentreports@example.com', password='StrongPass123!', is_active=True)
        bootstrap_family_account(user)
        kid = user.kids.first()

        session = self.client.session
        session['parent_verified'] = True
        session['selected_kid_id'] = kid.id
        session.save()

        self.client.force_login(user)
        response = self.client.get(reverse('starbank:reports') + f'?kid={kid.id}')

        self.assertContains(response, 'Kid profile', status_code=200)
        self.assertContains(response, 'Back to parent dashboard', status_code=200)
        self.assertContains(response, 'Weekly progress', status_code=200)
        self.assertContains(response, 'Monthly overview', status_code=200)


class KidReportsTabTests(TestCase):
    def test_kid_dashboard_shows_reports_tab_and_report_sections(self):
        user = User.objects.create_user(email='kidreports@example.com', password='StrongPass123!', is_active=True)
        bootstrap_family_account(user)
        kid = user.kids.first()

        self.client.force_login(user)
        response = self.client.get(reverse('starbank:kid-dashboard') + f'?kid={kid.id}')

        self.assertContains(response, 'Reports', status_code=200)
        self.assertContains(response, 'Daily report', status_code=200)
        self.assertContains(response, 'Weekly report', status_code=200)
        self.assertContains(response, 'Monthly overview', status_code=200)


