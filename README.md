# Organigrama Web Interactivo & Gestión de Dotación (SNAF Jujuy)

Sistema web para la visualización interactiva del organigrama institucional y la gestión integral de personal de la **Secretaría de Niñez, Adolescencia y Familia (SNAF)** del Gobierno de la Provincia de Jujuy.

Desarrollado en base a los listados oficiales de nómina GDE, fichas territoriales de las 30 OPDs, nómina de Dirección de Juventud y el organigrama ministerial oficial.

---

## 🌟 Características Principales

### 1. 🏢 Organigrama Jerárquico Dinámico
- Visualización interactiva en árbol con todos los niveles jerárquicos:
  - **Nivel 0:** Conducción Central (Dra. Marta Laura Iriarte Duberti - Secretaria SNAF).
  - **Nivel 1:** Direcciones Provinciales y Coordinación General:
    - Dirección de Niñez, Adolescencia y Familia (Dra. Mariela Angélica Gloss).
    - Dirección Provincial de Dispositivos de Cuidados (Lic. Mario Vacaflor).
    - Coordinación de Gestión Administrativa (María José Chara).
    - Dirección de Juventud (Darío Nicolás D'Antuene).
    - Despacho General, Mesa de Entrada, Recursos Humanos, Informática/GDE, Prensa, Planificación y Promoción de Derechos.
  - **Nivel 2:** Coordinaciones especializadas, Programas y Dispositivos (Línea 102, Entornos Digitales, Coordinación OPD, CDIs, Casa del Niño, Casa del Adolescente, Penal Juvenil, PAE, Áreas Contables/Tesorería/Compras/Mantenimiento).
  - **Nivel 3:** Red descentralizada de las 30 Oficinas de Protección de Derechos (OPD), CAD, Centro San Pedro, MPT, DAPPA.
- Controles de **Zoom (+ / - / Reset)** y desplazamiento libre (**Pan / Drag**).
- Expandir / Colapsar ramas.
- Buscador en tiempo real que resalta la ruta y la tarjeta del sector o agente.
- **Filtro por Dirección / Repartición** para aislar ramas específicas.
- Ficha deslizable (*Slide-over drawer*) al hacer clic en cualquier sector con su nómina completa de agentes y autoridades.

### 2. ⭐ Soporte Completo Multi-Sector
> **"Un personal puede desempeñar funciones en más de un sector simultáneamente"**
- Cada agente posee una lista dinámica de asignaciones de sectores con su respectiva:
  - Dependencia / Sector asignado.
  - Función / Cargo en ese sector (ej: Abogado Titular, Itinerante BIS, Trabajador Social, etc.).
  - Condición (Titular, Itinerante BIS, Base Compartida, Jerárquico/Responsable, etc.).
  - Superior inmediato en ese sector.
  - Observaciones específicas de la función.
- El sistema detecta y resalta automáticamente a todos los agentes multi-sector (ej: Dr. Nicolás Martínez cubriendo OPD 28, OPD 11 y OPD 08; Dra. Romina Cortés en OPD 24 y 25; Dra. Marcela Juárez en OPD 06 y 22; Claudia Calderón en Prensa y Juventud; etc.).
- Permite agregar o quitar sectores a cualquier personal desde el modal interactivo con un solo clic en `➕ Asignar a otro Sector / Función`.
- Los contadores de dotación y las listas de personal de cada sector en el organigrama se recalculan y actualizan automáticamente al editar las asignaciones.

### 3. 🗺️ Red Territorial de 30 OPDs
- Catálogo interactivo de las 30 Oficinas de Protección de Derechos de la provincia.
- Filtros por región geográfica:
  - **Valles & Capital** (13 oficinas)
  - **Ramal / Yungas** (10 oficinas)
  - **Quebrada** (4 oficinas)
  - **Puna** (3 oficinas)
- Fichas territoriales con: dirección física, horarios de atención, teléfonos de guardia / línea WIN, estado de cobertura legal (abogado titular o itinerante BIS) y detalle del equipo interdisciplinario.

### 4. 👥 Gestión de Personal
- Nómina completa unificada con más de 310 agentes.
- Búsqueda instantánea por Nombre, Apellido, CUIL, Usuario GDE o Rol.
- Filtro dedicado para personal **⭐ Multi-Sector**.
- Filtro por estado de Capacitación GDE (Aula Virtual, Presencial, Pendiente, Sin Capacitación).
- Filtro por especialidad profesional (Abogados, Trabajo Social, Psicología, Administrativos, Operadores, Responsables).
- Conmutador entre **Vista de Tabla** y **Vista de Tarjetas**.
- Formulario modal completo para registrar o modificar datos personales, situación de revista, legajo GDE y asignaciones multi-sector.

### 5. 🏛️ Estructura de Sectores
- Catálogo de los 75 sectores institucionales.
- Capacidad para crear nuevos sectores, redefinir jerarquías de dependencia y modificar autoridades responsables.

### 6. 📊 Tablero & Estadísticas
- Indicadores en tiempo real de dotación, sectores, porcentaje de capacitación GDE y volumen multi-sector.
- Barras de progreso de distribución por Dirección Provincial.
- Gráfico de cumplimiento de formación en Aula Virtual y encuentros presenciales GDE.
- Listado consolidado de itinerancias y agentes con doble o triple dependencia funcional.

### 7. 💾 Persistencia & Exportación
- **Autoguardado en tiempo real** en `localStorage` del navegador.
- **Descargar Backup (JSON)**: permite guardar una copia completa de la base de datos localmente.
- **Cargar Backup (JSON)**: permite restaurar o compartir el estado entre diferentes computadoras.
- **Exportar a CSV / Excel**: descarga la nómina completa de agentes con todos sus datos y sectores asignados.
- **Restablecer**: botón para retornar a la nómina inicial en cualquier momento.

---

## 🚀 Cómo Ejecutar la Aplicación

### Opción 1: Acceso Directo (Recomendado en Windows)
Haga doble clic en el archivo:
```text
C:\Users\darorquera\.gemini\antigravity\scratch\organigrama-snaf\abrir_organigrama.bat
```
O simplemente abra `index.html` con su navegador web preferido (Google Chrome, Microsoft Edge, Mozilla Firefox).

### Opción 2: Servidor Django en Desarrollo
Desde PowerShell o terminal:
```powershell
Set-Location "E:\datos\Documentos\proyectoOrganigrama"
python manage.py runserver 8000
```
Y luego abra:
* **Vista Pública:** `http://localhost:8000/organigrama/`
* **Panel de Gestión:** `http://localhost:8000/gestion/`
* **Django Admin:** `http://localhost:8000/django-admin/`

### Opción 3: Despliegue en Producción con Coolify / Docker
Consulte la guía completa paso a paso en [COOLIFY_DEPLOY.md](file:///E:/datos/Documentos/proyectoOrganigrama/COOLIFY_DEPLOY.md).

---

## 📁 Estructura del Proyecto Django
- `manage.py`: Utilidad de comandos de Django.
- `Dockerfile`: Imagen de contenedor lista para Coolify con Gunicorn y WhiteNoise.
- `docker-compose.yml`: Configuración de servicios y volumen persistente de datos.
- `entrypoint.sh`: Script de arranque que ejecuta migraciones, siembra inicial y gunicorn.
- `requirements.txt`: Dependencias de Python para producción.
- `core/`: Configuración del proyecto Django (`settings.py`, `urls.py`, `wsgi.py`).
- `organigrama/`: Aplicación Django con modelos de persistencia, vistas, APIs y plantillas.
  - `models.py`: Modelo `OrganigramaState` para almacenar el estado completo en SQLite/PostgreSQL.
  - `views.py`: Vistas web y endpoints de sincronización (`/api/state/`, `/health/`).
  - `templates/organigrama/`: Plantillas HTML (`organigrama.html` e `index.html`).
  - `static/organigrama/`: Hojas de estilo CSS, scripts JS y recursos estáticos.
- `data/`: Directorio local para la base de datos persistente `db.sqlite3`.
- `COOLIFY_DEPLOY.md`: Instrucciones detalladas de despliegue en Coolify.
