import secrets
from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import User, Organization, Membership
from billing.models import Plan, ModelConfig, RoutingRule, APIKey


class Command(BaseCommand):
    help = "Seed demo data: plans, models, routing rules, owner user, org, and API key."

    def handle(self, *args, **options):
        with transaction.atomic():
            free_plan, _ = Plan.objects.get_or_create(
                name="free",
                defaults={"monthly_request_limit": 100, "requests_per_minute": 10, "price": 0, "cache_ttl_seconds": 3600},
            )
            pro_plan, _ = Plan.objects.get_or_create(
                name="pro",
                defaults={"monthly_request_limit": 1000, "requests_per_minute": 60, "price": 29, "cache_ttl_seconds": 86400},
            )
            enterprise_plan, _ = Plan.objects.get_or_create(
                name="enterprise",
                defaults={"monthly_request_limit": 999999, "requests_per_minute": 300, "price": 99, "cache_ttl_seconds": 604800},
            )

            gemini_model, _ = ModelConfig.objects.get_or_create(
                name="gemini-2.0-flash",
                defaults={"provider": "gemini", "input_cost_per_1k": 0.0001, "output_cost_per_1k": 0.0004, "is_active": True},
            )
            gpt4o_mini_model, _ = ModelConfig.objects.get_or_create(
                name="gpt-4o-mini",
                defaults={"provider": "openai", "input_cost_per_1k": 0.00015, "output_cost_per_1k": 0.0006, "is_active": True},
            )
            gpt4_model, _ = ModelConfig.objects.get_or_create(
                name="gpt-4",
                defaults={"provider": "openai", "input_cost_per_1k": 0.0003, "output_cost_per_1k": 0.0012, "is_active": True},
            )

            for plan, primary, fallbacks in [
                (free_plan, gemini_model, [gpt4o_mini_model]),
                (pro_plan, gpt4o_mini_model, [gemini_model]),
                (enterprise_plan, gpt4_model, [gpt4o_mini_model]),
            ]:
                rule, _ = RoutingRule.objects.get_or_create(
                    plan=plan,
                    primary_model=primary,
                    defaults={"timeout_seconds": 10},
                )
                rule.fallback_models.set(fallbacks)

            demo_email = "owner@demo.ai"
            if not User.objects.filter(email=demo_email).exists():
                demo_user = User.objects.create_user(
                    email=demo_email,
                    password="demo1234",
                    is_verified=True,
                    is_active=True,
                )
                demo_org = Organization.objects.create(
                    name="Demo Organization",
                    slug="demo-org",
                    plan=free_plan,
                )
                Membership.objects.create(
                    user=demo_user,
                    organization=demo_org,
                    role="owner",
                )

            api_key = APIKey.objects.filter(organization__slug="demo-org").first()
            if not api_key:
                raw_key = "sk_live_" + "".join(secrets.choice("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(32))
                api_key = APIKey.objects.create(
                    organization=Organization.objects.get(slug="demo-org"),
                    name="Demo API Key",
                    permissions="write",
                )
                api_key.key_prefix = raw_key[:12]
                api_key.key_hash = __import__("hashlib").sha256(raw_key.encode()).hexdigest()
                api_key.save(update_fields=["key_prefix", "key_hash"])
                self.stdout.write(self.style.SUCCESS(f"Created API Key: {raw_key}"))

            self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
            self.stdout.write(self.style.SUCCESS("Owner: owner@demo.ai / demo1234"))
