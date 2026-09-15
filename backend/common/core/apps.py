from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "common.core"

    def ready(self):
        import common.core.signals  # noqa: F401
