from .services import bootstrap_family_account


def family_context(request):
    if request.user.is_authenticated:
        bootstrap_family_account(request.user)
        return {
            'family_settings': request.user.family_settings,
            'family_kids': request.user.kids.all(),
        }
    return {}

