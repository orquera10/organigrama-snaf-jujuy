# ==============================================================================
# Dockerfile para SNAF Organigrama - Despliegue en Coolify / Docker
# ==============================================================================
FROM python:3.12-slim

# Variables de entorno de Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DATA_DIR=/app/data

# Instalar dependencias del sistema mínimas
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias de Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código de la aplicación
COPY . /app/

# Crear directorio de datos para volumen persistente SQLite y normalizar saltos de línea LF
RUN mkdir -p /app/data && sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Puerto expuesto (detectado automáticamente por Coolify)
EXPOSE 8000

# Volumen persistente para la base de datos SQLite
VOLUME ["/app/data"]

# Healthcheck rápido compatible con Traefik / Coolify
HEALTHCHECK --interval=5s --timeout=3s --start-period=3s --retries=5 \
    CMD curl -f http://127.0.0.1:8000/health/ || exit 1

# Comando de inicio
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
