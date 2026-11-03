"""
Django settings for SNAF Organigrama project.
Configured for production deployment on Coolify / Docker and local development.
"""

import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file if it exists
env_file = BASE_DIR / '.env'
if env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
    except ImportError:
        pass

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/stable/howto/deployment/checklist/

SECRET_KEY = os.environ.get(
    'SECRET_KEY',
    'django-insecure-snaf-organigrama-secret-key-change-in-production-2026-snaf-jujuy'
)

# DEBUG: True by default for local development. Set DEBUG=False in .env for production.
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')

# ALLOWED_HOSTS
allowed_hosts_str = os.environ.get(
    'ALLOWED_HOSTS',
    '*,organigrama.secnaf.jujuy.gob.ar,45.186.124.153,localhost,127.0.0.1'
)
ALLOWED_HOSTS = list({h.strip() for h in allowed_hosts_str.split(',') if h.strip()} | {
    '*', 'organigrama.secnaf.jujuy.gob.ar', '45.186.124.153', 'localhost', '127.0.0.1'
})

# CSRF_TRUSTED_ORIGINS: essential for Coolify / Traefik reverse proxies (HTTPS) and port 8031
default_csrf_origins = (
    'https://organigrama.secnaf.jujuy.gob.ar '
    'http://organigrama.secnaf.jujuy.gob.ar '
    'https://organigrama.secnaf.jujuy.gob.ar:8031 '
    'http://organigrama.secnaf.jujuy.gob.ar:8031 '
    'http://45.186.124.153 '
    'https://45.186.124.153 '
    'http://45.186.124.153:8031 '
    'https://45.186.124.153:8031 '
    'http://localhost:8000 '
    'http://localhost:8031 '
    'http://127.0.0.1:8000 '
    'http://127.0.0.1:8031'
)
csrf_trusted_str = os.environ.get('CSRF_TRUSTED_ORIGINS', default_csrf_origins)
CSRF_TRUSTED_ORIGINS = list({
    o.strip().rstrip('/') for o in (csrf_trusted_str + ' ' + default_csrf_origins).replace(',', ' ').split()
    if o.strip() and ('://' in o) and ('*' not in o or '*.' in o)
} | {
    'https://organigrama.secnaf.jujuy.gob.ar',
    'http://organigrama.secnaf.jujuy.gob.ar',
    'https://organigrama.secnaf.jujuy.gob.ar:8031',
    'http://organigrama.secnaf.jujuy.gob.ar:8031',
    'http://45.186.124.153',
    'https://45.186.124.153',
    'http://45.186.124.153:8031',
    'https://45.186.124.153:8031',
})

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'whitenoise.runserver_nostatic',
    'django.contrib.staticfiles',
    'organigrama.apps.OrganigramaConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Immediately after SecurityMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'organigrama' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'

# Database
# Si se define DB_HOST en las variables de entorno, se conecta automáticamente a PostgreSQL.
# En caso contrario, utiliza SQLite persistente en /app/data o ./data/
DB_HOST = os.environ.get('DB_HOST', '').strip()
DB_NAME = os.environ.get('DB_NAME', 'snaf_organigrama').strip()
DB_USER = os.environ.get('DB_USER', 'postgres').strip()
DB_PASSWORD = os.environ.get('DB_PASSWORD', '').strip()
DB_PORT = os.environ.get('DB_PORT', '5432').strip() or '5432'

if DB_HOST:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
            'CONN_MAX_AGE': 60,
        }
    }
else:
    data_dir_env = os.environ.get('DATA_DIR')
    if data_dir_env:
        data_dir = Path(data_dir_env)
    elif os.path.exists('/app/data'):
        data_dir = Path('/app/data')
    else:
        data_dir = BASE_DIR / 'data'

    data_dir.mkdir(parents=True, exist_ok=True)
    db_sqlite_path = data_dir / 'db.sqlite3'

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': str(db_sqlite_path),
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'es-ar'
TIME_ZONE = 'America/Argentina/Jujuy'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = []

# WhiteNoise settings
WHITENOISE_USE_FINDERS = DEBUG
WHITENOISE_AUTOREFRESH = DEBUG

# WhiteNoise storage: compresses files and caches forever
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Traefik / Coolify Reverse Proxy settings
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

# Authentication & Access Control
LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'organigrama'
LOGOUT_REDIRECT_URL = 'login'
