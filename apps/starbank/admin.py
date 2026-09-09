from django.contrib import admin

from .models import DailyTask, FamilySettings, KidProfile, SavingsGoal, StarAdjustment, TaskTemplate, WithdrawalRequest


@admin.register(FamilySettings)
class FamilySettingsAdmin(admin.ModelAdmin):
    list_display = ('user', 'daily_star_limit', 'star_to_dollar_rate', 'theme', 'notifications_enabled')


@admin.register(KidProfile)
class KidProfileAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'avatar_emoji', 'created_at')
    search_fields = ('name', 'user__email')


@admin.register(TaskTemplate)
class TaskTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'stars', 'is_active', 'sort_order')
    list_filter = ('is_active',)


@admin.register(DailyTask)
class DailyTaskAdmin(admin.ModelAdmin):
    list_display = ('name', 'kid', 'date', 'stars', 'completed_at')
    list_filter = ('date', 'completed_at')


@admin.register(StarAdjustment)
class StarAdjustmentAdmin(admin.ModelAdmin):
    list_display = ('kid', 'stars', 'reason', 'date', 'created_at')


@admin.register(SavingsGoal)
class SavingsGoalAdmin(admin.ModelAdmin):
    list_display = ('name', 'kid', 'target_amount', 'current_amount')


@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = ('kid', 'amount', 'category', 'status', 'created_at')
    list_filter = ('status', 'category')

