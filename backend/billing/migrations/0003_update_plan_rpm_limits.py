"""
Data migration: update Plan.requests_per_minute to match the new
rate_limiter.py values (Free: 60, Pro: 120, Enterprise: 300).

The previous defaults (10 / 60 / 300) were set via get_or_create so they
were only applied on first-run. Existing rows in the database still carry
the old values — this migration corrects them in place.
"""
from django.db import migrations


def update_plan_rpm(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    rpm_map = {
        "free": 60,
        "pro": 120,
        "enterprise": 300,
    }
    for plan_name, new_rpm in rpm_map.items():
        Plan.objects.filter(name=plan_name).update(requests_per_minute=new_rpm)


def reverse_plan_rpm(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    old_rpm_map = {
        "free": 10,
        "pro": 60,
        "enterprise": 300,
    }
    for plan_name, old_rpm in old_rpm_map.items():
        Plan.objects.filter(name=plan_name).update(requests_per_minute=old_rpm)


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0002_alter_apikey_permissions_and_more"),
    ]

    operations = [
        migrations.RunPython(update_plan_rpm, reverse_code=reverse_plan_rpm),
    ]
