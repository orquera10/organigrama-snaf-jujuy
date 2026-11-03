# 🚀 Guía de Despliegue en Coolify: SNAF Organigrama (Django)

Este proyecto ha sido migrado a **Django 5.x / 6.x** y empaquetado para su despliegue en un servidor con **Coolify**, listo para producción con **Gunicorn**, **WhiteNoise** y almacenamiento persistente en SQLite (o PostgreSQL).

---

## 📋 Arquitectura de la Aplicación

* **Backend:** Django con base de datos SQLite persistente (almacenada en `/app/data/db.sqlite3` mediante un volumen Docker persistente).
* **Servidor Web:** Gunicorn (servidor WSGI optimizado para producción).
* **Archivos Estáticos:** Servidos eficientemente por WhiteNoise con compresión gzip y brotli.
* **API REST:** Endpoint `/api/state/` para sincronizar cambios realizados desde el panel de gestión hacia la base de datos central.
* **Vistas Disponibles:**
  * `/login/`: **Portal de Acceso Seguro**. Protege los datos sensibles de la dotación (Ley 25.326).
  * `/` o `/organigrama/`: **Vista de Consulta del Organigrama**. Accesible para todos los usuarios autorizados (administradores y usuarios de consulta).
  * `/gestion/`: **Panel de Gestión y Dotación de Personal**. Exclusivo para administradores.
  * `/django-admin/`: **Panel Nativo de Django** para superusuarios.
  * `/health/`: **Endpoint de Monitoreo** para los chequeos de salud de Coolify.

---

## 🔐 Cuentas de Acceso Preconfiguradas

| Usuario | Contraseña Inicial | Rol / Alcance | Acceso Permitido |
| :--- | :--- | :--- | :--- |
| **`dorquera`** *(Darío Orquera)* | `12345678` | **Administrador Total** (Superuser) | Organigrama + Panel de Gestión + Django Admin |
| **`miriarte`** *(Marta Iriarte)* | `123456` | **Usuario Estándar** (Consulta) | Únicamente Organigrama *(acceso bloqueado a Gestión)* |

> [!NOTE]
> Para cambiar contraseñas una vez desplegado el sistema, ingresa al panel de Django Admin en `/django-admin/` con el usuario `dorquera` o ejecuta en la terminal de Coolify:
> `python manage.py changepassword <usuario>`

---

## 🛠️ Paso a Paso para Desplegar en Coolify

### Opción 1: Despliegue directo desde Git (Recomendado)

1. **Subir el proyecto a un repositorio Git** (GitHub, GitLab, Gitea o repositorio privado).
2. En el panel de **Coolify**, ingresa a tu **Project / Environment** y haz clic en:
   * **+ New** > **Application** > **Public / Private Repository**.
3. Selecciona tu repositorio y rama (ej: `main`).
4. En la configuración de la aplicación:
   * **Build Pack:** Selecciona `Dockerfile`.
   * **Port:** Establece `8000`.
5. En la pestaña **Configuration** > **General**:
   * **Domains:** Ingresa el dominio asignado a tu aplicación (ej: `https://organigrama.snaf.jujuy.gob.ar` o el subdominio que te provea Coolify). Traefik generará automáticamente el certificado SSL con Let's Encrypt.
6. En la pestaña **Storages** (Muy Importante para Persistencia de Datos):
   * Haz clic en **+ Add Storage**.
   * **Destination Path:** `/app/data`
   * **Volume Name:** `snaf_organigrama_data`
   *(Esto asegura que las modificaciones de personal y sectores no se pierdan al reiniciar o actualizar el contenedor).*
7. En la pestaña **Environment Variables**, añade:
   ```env
   SECRET_KEY=tu_clave_secreta_super_segura_de_django
   DEBUG=False
   ALLOWED_HOSTS=*
   CSRF_TRUSTED_ORIGINS=https://tu-dominio.com,https://*.coolify.app
   DATA_DIR=/app/data
   ```
8. Haz clic en **Deploy**. Coolify construirá la imagen Docker, ejecutará las migraciones, sembrará los 86 sectores y 294 agentes automáticamente, y publicará el sitio web en tu dominio.

---

### Opción 2: Despliegue usando Docker Compose en Coolify

Si prefieres usar Docker Compose en Coolify:

1. En Coolify: **+ New** > **Application** > **Docker Compose**.
2. Pega el contenido de [`docker-compose.yml`](file:///E:/datos/Documentos/proyectoOrganigrama/docker-compose.yml):
   ```yaml
   services:
     web:
       build:
         context: .
         dockerfile: Dockerfile
       container_name: snaf_organigrama
       restart: unless-stopped
       ports:
         - "8000:8000"
       environment:
         - SECRET_KEY=clave-secreta-produccion-snaf
         - DEBUG=False
         - ALLOWED_HOSTS=*
         - CSRF_TRUSTED_ORIGINS=https://tu-dominio.com,http://*
         - DATA_DIR=/app/data
       volumes:
         - organigrama_data:/app/data
       healthcheck:
         test: ["CMD", "curl", "-f", "http://localhost:8000/health/"]
         interval: 30s
         timeout: 5s
         retries: 3
         start_period: 10s

   volumes:
     organigrama_data:
       name: snaf_organigrama_data
   ```
3. En la sección **Domains**, asigna tu dominio en el puerto `8000` del servicio `web`.
4. Haz clic en **Deploy**.

---

## 🔑 Variables de Entorno Explicadas

| Variable | Valor Recomendado | Propósito |
| :--- | :--- | :--- |
| `SECRET_KEY` | `cadena_alfanumerica_larga` | Firma criptográfica de sesiones y cookies de Django. |
| `DEBUG` | `False` | Desactiva mensajes de error sensibles en producción. |
| `ALLOWED_HOSTS` | `*` o `organigrama.tudominio.gob.ar` | Hostnames HTTP permitidos. |
| `CSRF_TRUSTED_ORIGINS` | `https://organigrama.tudominio.gob.ar` | Impide bloqueos de CSRF cuando el tráfico pasa por el proxy SSL de Traefik/Coolify. |
| `DATA_DIR` | `/app/data` | Directorio dentro del contenedor donde reside el archivo `db.sqlite3`. |

---

## 🧑‍💻 Comandos Útiles dentro del Contenedor

Para ejecutar comandos administrativos dentro de Coolify (usando la pestaña **Terminal / Exec**):

* **Crear Superusuario de Django:**
  ```bash
  python manage.py createsuperuser
  ```
  *(Te permitirá iniciar sesión en `/django-admin/`)*

* **Restablecer datos de fábrica manualmente:**
  ```bash
  python manage.py load_initial_data --force
  ```

* **Respaldar la base de datos:**
  El archivo `db.sqlite3` se encuentra dentro del volumen persistente `/app/data/db.sqlite3`. Puedes descargarlo en cualquier momento usando el explorador de archivos o SCP/SFTP de tu servidor.
