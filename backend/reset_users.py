import django, os, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "worknest_backend.settings")
django.setup()

from api.models import User
from django.contrib.auth import authenticate

users_to_create = [
    ("admin",    "Admin",    "admin@worknest.io",    True, True),
    ("manager",  "Manager",  "manager@worknest.io",  False, False),
    ("employee", "Employee", "employee@worknest.io", False, False),
]

for username, role, email, is_staff, is_super in users_to_create:
    u, created = User.objects.get_or_create(username=username)
    u.role = role
    u.email = email
    u.is_active = True
    u.is_staff = is_staff
    u.is_superuser = is_super
    u.set_password("password")
    u.save()
    print(f"{'Created' if created else 'Updated'}: {u.username} | role={u.role} | active={u.is_active}")

print("\nVerifying authentication:")
for username in ["admin", "manager", "employee"]:
    user = authenticate(username=username, password="password")
    print(f"  authenticate('{username}') => {user}")

print("\nAll DB users:")
for u in User.objects.all():
    print(f"  id={u.id} username={u.username} role={u.role} email={u.email}")
