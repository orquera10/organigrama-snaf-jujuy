from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import OrganigramaState

# Personalización del Panel Admin de Django
admin.site.site_header = "Administración de Usuarios y Sistema · SNAF Jujuy"
admin.site.site_title = "Admin SNAF Jujuy"
admin.site.index_title = "Gestión de Usuarios, Contraseñas y Base de Datos"

# Personalización de la vista de Usuarios para mostrar claramente el rol en el sistema
admin.site.unregister(User)

@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    list_display = ('username', 'first_name', 'last_name', 'email', 'get_rol_sistema', 'is_active', 'is_staff', 'last_login')
    list_filter = ('is_staff', 'is_superuser', 'is_active')
    search_fields = ('username', 'first_name', 'last_name', 'email')

    @admin.display(description='Rol en el Sistema')
    def get_rol_sistema(self, obj):
        if obj.is_superuser or obj.is_staff:
            return "🔑 Administrador (Gestión + Organigrama)"
        return "👁️ Consulta (Solo Organigrama)"


@admin.register(OrganigramaState)
class OrganigramaStateAdmin(admin.ModelAdmin):
    list_display = ('name', 'version', 'get_sectores_count', 'get_personal_count', 'updated_at', 'created_at')
    readonly_fields = ('version', 'updated_at', 'created_at')
    search_fields = ('name',)

    @admin.display(description='Total Sectores')
    def get_sectores_count(self, obj):
        if isinstance(obj.data, dict) and 'sectores' in obj.data:
            return len(obj.data['sectores'])
        return 0

    @admin.display(description='Total Agentes')
    def get_personal_count(self, obj):
        if isinstance(obj.data, dict) and 'personal' in obj.data:
            return len(obj.data['personal'])
        return 0
