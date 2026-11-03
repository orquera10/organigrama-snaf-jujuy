import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from django.contrib.auth.models import User
from organigrama.models import OrganigramaState

class Command(BaseCommand):
    help = 'Inicializa la base de datos con los sectores, nómina de personal y usuarios de acceso'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Sobrescribe el estado en base de datos con initial_data.json',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)
        
        # 1. Crear Usuarios Iniciales del Sistema (sin pisar contraseñas si ya existen)
        self.setup_users(force=force)

        # 2. Inicializar o actualizar estado del organigrama
        exists = OrganigramaState.objects.filter(name='principal').exists()

        if exists and not force:
            self.stdout.write(self.style.SUCCESS(
                'El estado del organigrama ya existe en la base de datos. Use --force para sobrescribir.'
            ))
            return

        json_path = settings.BASE_DIR / 'initial_data.json'
        if not json_path.exists():
            json_path = settings.BASE_DIR / 'data.json'

        if not json_path.exists():
            self.stdout.write(self.style.ERROR(f'No se encontró archivo de datos en {json_path}'))
            return

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        state, created = OrganigramaState.objects.update_or_create(
            name='principal',
            defaults={
                'data': data,
                'version': 1
            }
        )

        sectores_count = len(data.get('sectores', []))
        personal_count = len(data.get('personal', []))

        action_str = 'creado' if created else 'sobrescrito'
        self.stdout.write(self.style.SUCCESS(
            f'Estado {action_str} con éxito: {sectores_count} sectores y {personal_count} agentes registrados.'
        ))

    def setup_users(self, force=False):
        # Usuario 1: Darío Orquera (Administrador Total)
        user_admin, created_admin = User.objects.get_or_create(username='dorquera')
        if created_admin or force:
            user_admin.first_name = 'Darío'
            user_admin.last_name = 'Orquera'
            user_admin.email = 'dorquera@jujuy.gob.ar'
            user_admin.is_staff = True
            user_admin.is_superuser = True
            user_admin.set_password('12345678')
            user_admin.save()
            self.stdout.write(self.style.SUCCESS(
                'Usuario Administrador [dorquera]: Creado (Acceso a Gestión y Organigrama)'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                'Usuario Administrador [dorquera]: Ya existe (se conserva su contraseña y configuración actual)'
            ))

        # Usuario 2: Marta Iriarte (Usuario Estándar - Solo Organigrama)
        user_std, created_std = User.objects.get_or_create(username='miriarte')
        if created_std or force:
            user_std.first_name = 'Marta Laura'
            user_std.last_name = 'Iriarte Duberti'
            user_std.email = 'miriarte@jujuy.gob.ar'
            user_std.is_staff = False
            user_std.is_superuser = False
            user_std.set_password('123456')
            user_std.save()
            self.stdout.write(self.style.SUCCESS(
                'Usuario Consulta [miriarte]: Creado (Acceso exclusivo a Organigrama)'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                'Usuario Consulta [miriarte]: Ya existe (se conserva su contraseña y configuración actual)'
            ))
