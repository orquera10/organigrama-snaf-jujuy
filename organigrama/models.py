import json
from pathlib import Path
from django.db import models
from django.conf import settings

class OrganigramaState(models.Model):
    """
    Guarda el estado completo y activo del organigrama, sectores y dotación de personal.
    Permite persistencia centralizada en base de datos para Coolify / Docker.
    """
    name = models.CharField(max_length=64, default='principal', unique=True, verbose_name='Identificador')
    data = models.JSONField(verbose_name='Estructura JSON (Sectores y Personal)')
    version = models.PositiveIntegerField(default=1, verbose_name='Versión del Estado')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Última Modificación')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de Creación')

    class Meta:
        verbose_name = 'Estado del Organigrama'
        verbose_name_plural = 'Estados del Organigrama'
        ordering = ['-updated_at']

    def __str__(self):
        sectores_count = len(self.data.get('sectores', [])) if isinstance(self.data, dict) else 0
        personal_count = len(self.data.get('personal', [])) if isinstance(self.data, dict) else 0
        return f"Organigrama SNAF v{self.version} ({sectores_count} sectores, {personal_count} agentes) - {self.updated_at.strftime('%d/%m/%Y %H:%M')}"

    @classmethod
    def get_current_state(cls):
        """
        Retorna el estado activo. Si aún no existe en base de datos,
        lo inicializa a partir de initial_data.json.
        """
        obj = cls.objects.filter(name='principal').first()
        if obj:
            return obj

        # Cargar datos iniciales
        json_path = settings.BASE_DIR / 'initial_data.json'
        if not json_path.exists():
            # Fallback a data.json
            json_path = settings.BASE_DIR / 'data.json'

        initial_dict = {
            "institucion": {
                "nombre": "Secretaría de Niñez, Adolescencia y Familia",
                "sigla": "SNAF",
                "ministerio": "Ministerio de Desarrollo Humano",
                "provincia": "Provincia de Jujuy",
                "autoridad_maxima": "Dra. Marta Laura Iriarte Duberti",
                "cargo_autoridad": "Secretaria de Niñez, Adolescencia y Familia",
                "fecha_actualizacion": "Octubre 2026"
            },
            "sectores": [],
            "personal": []
        }

        if json_path.exists():
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    initial_dict = json.load(f)
            except Exception as e:
                print(f"[OrganigramaState] Error al leer {json_path}: {e}")

        obj = cls.objects.create(
            name='principal',
            data=initial_dict,
            version=1
        )
        return obj
