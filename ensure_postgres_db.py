"""
Script de inicialización automática para PostgreSQL.
Se ejecuta en el arranque del contenedor (entrypoint.sh) antes de las migraciones de Django.
Si las variables de entorno de PostgreSQL (DB_HOST) están configuradas y el servidor responde,
verifica si la base de datos (DB_NAME) existe y, si no, la crea automáticamente con codificación UTF-8.
Si DB_HOST no está definido o tiene el texto de ejemplo, utiliza SQLite automáticamente sin bloquear el arranque.
"""

import os
import sys
import time
from pathlib import Path

# Cargar .env local si existe
env_file = Path(__file__).resolve().parent / '.env'
if env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
    except ImportError:
        pass

PLACEHOLDER_HOSTS = {
    '',
    'aqui_host_o_ip_de_tu_postgres',
    'nombre-o-ip-de-tu-postgres',
    'tu_host_postgres',
}


def ensure_database():
    db_host = os.environ.get('DB_HOST', '').strip()
    if db_host.lower() in PLACEHOLDER_HOSTS:
        print("==> [DB Init] DB_HOST no configurado (o con valor de ejemplo). Usando SQLite en /app/data/db.sqlite3.")
        return

    db_name = os.environ.get('DB_NAME', 'snaf_organigrama').strip() or 'snaf_organigrama'
    db_user = os.environ.get('DB_USER', 'postgres').strip() or 'postgres'
    db_password = os.environ.get('DB_PASSWORD', '').strip()
    db_port = os.environ.get('DB_PORT', '5432').strip() or '5432'
    default_maint_db = os.environ.get('DB_MAINTENANCE_NAME', 'postgres').strip() or 'postgres'

    try:
        import psycopg2
        from psycopg2 import sql
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    except ImportError:
        print("==> [DB Init] AVISO: psycopg2-binary no instalado. Se usará SQLite.")
        return

    print(f"==> [DB Init] Verificando PostgreSQL en {db_host}:{db_port} (usuario: {db_user}, base: {db_name})...")

    max_retries = 5
    retry_delay = 2
    conn = None

    # 1. Intentar conectar directamente a la base de datos objetivo por si ya existe
    for attempt in range(1, max_retries + 1):
        try:
            conn_test = psycopg2.connect(
                dbname=db_name,
                user=db_user,
                password=db_password,
                host=db_host,
                port=db_port,
                connect_timeout=3
            )
            conn_test.close()
            print(f"==> [DB Init] Base de datos PostgreSQL '{db_name}' verificada y lista.")
            return
        except psycopg2.OperationalError as e:
            err_msg = str(e).lower()
            if 'does not exist' in err_msg or 'no existe' in err_msg:
                break
            print(f"==> [DB Init] Intento {attempt}/{max_retries} conectando a PostgreSQL ({db_host}:{db_port}): {e}")
            if attempt == max_retries:
                print("==> [DB Init] AVISO: No se pudo conectar a PostgreSQL. El sistema usará SQLite como respaldo para no interrumpir el servicio.")
                return
            time.sleep(retry_delay)

    # 2. Conectar a la base de mantenimiento ('postgres' o 'template1') para crear DB_NAME
    for maint_db in [default_maint_db, 'postgres', 'template1']:
        try:
            conn = psycopg2.connect(
                dbname=maint_db,
                user=db_user,
                password=db_password,
                host=db_host,
                port=db_port,
                connect_timeout=4
            )
            break
        except psycopg2.OperationalError:
            continue

    if conn is None:
        print(f"==> [DB Init] AVISO: No se pudo conectar a PostgreSQL para crear '{db_name}'. Usando SQLite de respaldo.")
        return

    try:
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        exists = cursor.fetchone()

        if not exists:
            print(f"==> [DB Init] La base de datos '{db_name}' no existe. Creándola automáticamente...")
            cursor.execute(
                sql.SQL("CREATE DATABASE {} ENCODING 'UTF8'").format(
                    sql.Identifier(db_name)
                )
            )
            print(f"==> [DB Init] Base de datos '{db_name}' creada exitosamente en PostgreSQL.")
        else:
            print(f"==> [DB Init] La base de datos '{db_name}' ya existe.")

        cursor.close()
    except Exception as e:
        print(f"==> [DB Init] Error al crear base de datos '{db_name}': {e}")
    finally:
        conn.close()


if __name__ == '__main__':
    ensure_database()
