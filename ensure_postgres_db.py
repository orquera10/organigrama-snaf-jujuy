"""
Script de inicialización automática para PostgreSQL.
Se ejecuta en el arranque del contenedor (entrypoint.sh) antes de las migraciones de Django.
Si las variables de entorno de PostgreSQL (DB_HOST) están configuradas y la base de datos (DB_NAME)
no existe aún en el servidor Postgres, la crea automáticamente con codificación UTF-8.
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


def ensure_database():
    db_host = os.environ.get('DB_HOST', '').strip()
    if not db_host:
        print("==> [DB Init] DB_HOST no definido. Usando base de datos SQLite local.")
        return

    db_name = os.environ.get('DB_NAME', 'snaf_organigrama').strip()
    db_user = os.environ.get('DB_USER', 'postgres').strip()
    db_password = os.environ.get('DB_PASSWORD', '').strip()
    db_port = os.environ.get('DB_PORT', '5432').strip() or '5432'
    default_maint_db = os.environ.get('DB_MAINTENANCE_NAME', 'postgres').strip()

    try:
        import psycopg2
        from psycopg2 import sql
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    except ImportError:
        print("==> [DB Init] ERROR: psycopg2-binary no está instalado.")
        sys.exit(1)

    print(f"==> [DB Init] Verificando conexión a PostgreSQL en {db_host}:{db_port} (usuario: {db_user})...")

    max_retries = 15
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
                connect_timeout=5
            )
            conn_test.close()
            print(f"==> [DB Init] La base de datos PostgreSQL '{db_name}' ya existe y está lista.")
            return
        except psycopg2.OperationalError as e:
            err_msg = str(e).lower()
            # Si el error indica que la base no existe, pasamos a crearla conectando a 'postgres' / 'template1'
            if f'"{db_name.lower()}" does not exist' in err_msg or 'does not exist' in err_msg or 'no existe' in err_msg:
                break
            print(f"==> [DB Init] Esperando al servidor PostgreSQL ({attempt}/{max_retries}): {e}")
            if attempt == max_retries:
                print("==> [DB Init] No se pudo conectar al servidor PostgreSQL tras varios intentos.")
                sys.exit(1)
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
                connect_timeout=5
            )
            break
        except psycopg2.OperationalError:
            continue

    if conn is None:
        print(f"==> [DB Init] ERROR: No se pudo conectar a PostgreSQL ({db_host}:{db_port}) para crear la base '{db_name}'. Verifique DB_USER y DB_PASSWORD.")
        sys.exit(1)

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
    finally:
        conn.close()


if __name__ == '__main__':
    ensure_database()
