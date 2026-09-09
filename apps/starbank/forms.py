from django import forms

from .models import FamilySettings, KidProfile, SavingsGoal, TaskTemplate, WithdrawalRequest


class ParentPinForm(forms.Form):
    pin = forms.CharField(max_length=4, min_length=4, widget=forms.PasswordInput(attrs={'placeholder': '1234'}))

    def clean_pin(self):
        pin = self.cleaned_data['pin'].strip()
        if not pin.isdigit() or len(pin) != 4:
            raise forms.ValidationError('PIN must be exactly 4 digits.')
        return pin


class FamilySettingsForm(forms.ModelForm):
    class Meta:
        model = FamilySettings
        fields = ['parent_pin', 'star_to_dollar_rate', 'daily_star_limit', 'theme', 'notifications_enabled', 'daily_notification_hour']
        widgets = {
            'parent_pin': forms.PasswordInput(render_value=True),
        }

    def clean_parent_pin(self):
        pin = (self.cleaned_data.get('parent_pin') or '').strip()
        if not pin.isdigit() or len(pin) != 4:
            raise forms.ValidationError('Parent PIN must be exactly 4 digits.')
        return pin

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.set_parent_pin(self.cleaned_data['parent_pin'])
        if commit:
            instance.save()
            self.save_m2m()
        return instance


class KidProfileForm(forms.ModelForm):
    class Meta:
        model = KidProfile
        fields = ['name', 'avatar_emoji']


class TaskTemplateForm(forms.ModelForm):
    class Meta:
        model = TaskTemplate
        fields = ['name', 'stars']


class DailyTaskForm(forms.Form):
    name = forms.CharField(max_length=200)
    stars = forms.IntegerField(min_value=1, max_value=10)


class StarAdjustmentForm(forms.Form):
    stars = forms.IntegerField(min_value=1, max_value=20)
    reason = forms.CharField(max_length=255)


class SavingsGoalForm(forms.ModelForm):
    class Meta:
        model = SavingsGoal
        fields = ['name', 'target_amount', 'current_amount', 'image_emoji']


class WithdrawalRequestForm(forms.ModelForm):
    amount = forms.DecimalField(min_value=0.01)

    class Meta:
        model = WithdrawalRequest
        fields = ['amount', 'category', 'description']

