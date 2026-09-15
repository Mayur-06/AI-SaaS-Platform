from django.db.models.signals import post_save
from django.dispatch import receiver
from accounts.models import Membership, Organization


@receiver(post_save, sender=Membership)
def ensure_owner_membership(sender, instance, created, **kwargs):
    if created and instance.role == Membership.ROLE_OWNER and instance.is_active:
        if instance.organization.plan is None:
            from billing.models import Plan
            free_plan, _ = Plan.objects.get_or_create(
                name=Plan.PLAN_FREE,
                defaults={"monthly_request_limit": 100, "requests_per_minute": 10, "price": 0},
            )
            instance.organization.plan = free_plan
            instance.organization.save(update_fields=["plan"])
