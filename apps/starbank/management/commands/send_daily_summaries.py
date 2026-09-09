from django.core.management.base import BaseCommand
from apps.starbank.services import send_daily_summary_emails


class Command(BaseCommand):
    help = 'Send daily Little Starts Bank summary emails to families who enabled notifications.'

    def handle(self, *args, **options):
        sent_count = send_daily_summary_emails()

        self.stdout.write(self.style.SUCCESS(f'Sent {sent_count} summary emails.'))

