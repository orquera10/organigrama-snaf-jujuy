#!/bin/sh
set -e

echo "==> [SNAF Organigrama] Iniciando contenedor..."

# Asegurar permisos del directorio de datos persistente (Coolify Volume)
mkdir -p /app/data

# 0. Si se configuró PostgreSQL (DB_HOST), verificar y crear la base de datos si no existe
echo "==> [SNAF Organigrama] Verificando motor de base de datos..."
python ensure_postgres_db.py

# 1. Aplicar migraciones pendientes
echo "==> [SNAF Organigrama] Ejecutando migraciones de base de datos..."
python manage.py migrate --noinput

# 2. Cargar nómina y estructura inicial si la base de datos está vacía
echo "==> [SNAF Organigrama] Verificando datos iniciales..."
python manage.py load_initial_data

# 3. Recolectar archivos estáticos para WhiteNoise
echo "==> [SNAF Organigrama] Recolectando archivos estáticos..."
python manage.py collectstatic --noinput

# 4. Iniciar Gunicorn
echo "==> [SNAF Organigrama] Servidor web listo en puerto 8000."
exec gunicorn core.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers ${GUNICORN_WORKERS:-3} \
    --threads ${GUNICORN_THREADS:-2} \
    --timeout ${GUNICORN_TIMEOUT:-60} \
    --access-logfile - \
    --error-logfile -
