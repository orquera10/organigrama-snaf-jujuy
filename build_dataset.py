import openpyxl
import json
import os
import re

path1 = r'C:\Users\darorquera\.gemini\antigravity\brain\d0e234f7-a2c0-4d3c-a0d5-7937cf70357e\.user_uploaded\media_1792668792463_92cb5ef1.xlsx'
path2 = r'C:\Users\darorquera\.gemini\antigravity\brain\d0e234f7-a2c0-4d3c-a0d5-7937cf70357e\.user_uploaded\media_1792668797995_3bf7120b.xlsx'

wb1 = openpyxl.load_workbook(path1, data_only=True)
wb2 = openpyxl.load_workbook(path2, data_only=True)

# 1. Parse OPD Summary (Resumen_por_OPD)
opd_summary = {}
s_opd_res = wb2['Resumen_por_OPD']
for r in list(s_opd_res.iter_rows(values_only=True))[1:]:
    if not r[0]: continue
    num = int(r[0])
    opd_summary[num] = {
        'num': num,
        'nombre': str(r[1]).strip() if r[1] else '',
        'direccion': str(r[2]).strip() if r[2] else '',
        'horario': str(r[3]).strip() if r[3] else '',
        'telefono_guardia': str(r[4]).strip() if r[4] else '',
        'cobertura': str(r[5]).strip() if r[5] else '',
        'total_personal_activo': r[6],
        'abogado_resumen': str(r[7]).strip() if r[7] else '',
        'equipo_resumen': str(r[8]).strip() if r[8] else '',
        'telefonos': str(r[9]).strip() if r[9] else '',
        'correos': str(r[10]).strip() if r[10] else ''
    }

print(f'Parsed {len(opd_summary)} OPD summaries')

# Define sectors catalog
sectors_catalog = [
    {
        'id': 'sec-snaf',
        'nombre': 'Secretaría de Niñez, Adolescencia y Familia (SNAF)',
        'nivel': 0,
        'tipo': 'Secretaría',
        'parent_id': None,
        'responsable': 'Dra. Marta Laura Iriarte Duberti',
        'cargo_responsable': 'Secretaria (Jerárquico) - Máxima Autoridad',
        'color': '#4f46e5',
        'descripcion': 'Órgano rector de las políticas públicas de niñez, adolescencia y familia en Jujuy.'
    },
    # Despacho y sus 3 dependencias
    {
        'id': 'despacho-general',
        'nombre': 'Despacho',
        'nivel': 1,
        'tipo': 'Área Operativa',
        'parent_id': 'sec-snaf',
        'responsable': 'Dra. Rosa Tejerina',
        'cargo_responsable': 'Responsable de Despacho',
        'color': '#4f46e5',
        'descripcion': 'Área central de despacho, coordinación de mesa de entrada, resoluciones y secretaría privada.'
    },
    {
        'id': 'despacho-tramite',
        'nombre': 'Despacho',
        'nivel': 2,
        'tipo': 'Área Operativa',
        'parent_id': 'despacho-general',
        'responsable': 'Noelia Perez',
        'cargo_responsable': 'Área Despacho',
        'color': '#6366f1',
        'descripcion': 'Gestión de trámites, proyectos y resoluciones ministeriales.'
    },
    {
        'id': 'mesa-entrada',
        'nombre': 'Mesa de Entrada',
        'nivel': 2,
        'tipo': 'Área Operativa',
        'parent_id': 'despacho-general',
        'responsable': 'José Sosa',
        'cargo_responsable': 'Responsable Mesa de Entrada',
        'color': '#818cf8',
        'descripcion': 'Recepción, registro, caratulado y distribución inicial de expedientes y notas oficiales.'
    },
    {
        'id': 'sec-privada',
        'nombre': 'Secretaria Privada',
        'nivel': 2,
        'tipo': 'Área Operativa',
        'parent_id': 'despacho-general',
        'responsable': 'Ana Tolaba',
        'cargo_responsable': 'Secretaría Privada',
        'color': '#eab308',
        'descripcion': 'Secretaría privada y agenda institucional dentro del área de Despacho.'
    },
    {
        'id': 'rrhh',
        'nombre': 'Recursos Humanos',
        'nivel': 1,
        'tipo': 'Área Operativa',
        'parent_id': 'sec-snaf',
        'responsable': 'Fabiana Alejandra Vivas',
        'cargo_responsable': 'Responsable',
        'color': '#059669',
        'descripcion': 'Administración del personal, legajos, asistencia y licencias.'
    },
    {
        'id': 'informatica',
        'nombre': 'Informática / Sistemas',
        'nivel': 1,
        'tipo': 'Área Técnica',
        'parent_id': 'sec-snaf',
        'responsable': 'A designar',
        'cargo_responsable': 'Sin referente designado',
        'color': '#2563eb',
        'descripcion': 'Soporte tecnológico, infraestructura de redes, sistemas y gestión GDE.'
    },
    {
        'id': 'prensa',
        'nombre': 'Prensa y Comunicación',
        'nivel': 1,
        'tipo': 'Área Técnica',
        'parent_id': 'sec-snaf',
        'responsable': 'Dra. Marta Laura Iriarte Duberti',
        'cargo_responsable': 'Supervisión Directa',
        'color': '#8b5cf6',
        'descripcion': 'Comunicación institucional, prensa y difusión de actividades.'
    },
    {
        'id': 'planificacion',
        'nombre': 'Planificación y Capacitación',
        'nivel': 1,
        'tipo': 'Área Técnica',
        'parent_id': 'sec-snaf',
        'responsable': 'Ileana Leguizamón',
        'cargo_responsable': 'Profesional Responsable',
        'color': '#d97706',
        'descripcion': 'Diseño de planes estratégicos y formación continua institucional.'
    },
    {
        'id': 'coord-promocion',
        'nombre': 'Coordinación de Promoción de Derechos',
        'nivel': 2,
        'tipo': 'Coordinación',
        'parent_id': 'dir-ninez',
        'responsable': 'Nora Roxana Guerrero',
        'cargo_responsable': 'Coordinadora (Jerárquico)',
        'color': '#ea580c',
        'descripcion': 'Promoción y divulgación activa de los derechos de NNyA en el territorio.'
    },
    # Coordinación de Gestión Administrativa
    {
        'id': 'coord-adm',
        'nombre': 'Coordinación de Gestión Administrativa',
        'nivel': 1,
        'tipo': 'Coordinación General',
        'parent_id': 'sec-snaf',
        'responsable': 'María José Chara',
        'cargo_responsable': 'Coordinadora (Jerárquico)',
        'color': '#0d9488',
        'descripcion': 'Coordinación financiera, contable, de suministros y operativa de la Secretaría.'
    },
    {
        'id': 'privada-adm',
        'nombre': 'Privada Gestión Administrativa',
        'nivel': 2,
        'tipo': 'Área de Apoyo',
        'parent_id': 'coord-adm',
        'responsable': 'María José Chara',
        'cargo_responsable': 'Coordinadora',
        'color': '#14b8a6',
        'descripcion': 'Soporte administrativo y coordinación de despacho contable.'
    },
    {
        'id': 'compras',
        'nombre': 'Compras y Suministros',
        'nivel': 2,
        'tipo': 'Área Operativa',
        'parent_id': 'coord-adm',
        'responsable': 'María José Chara',
        'cargo_responsable': 'Supervisión Directa',
        'color': '#0f766e',
        'descripcion': 'Adquisición de bienes, insumos y contrataciones de servicios.'
    },
    {
        'id': 'info-contable',
        'nombre': 'Información Contable',
        'nivel': 2,
        'tipo': 'Área Operativa',
        'parent_id': 'coord-adm',
        'responsable': 'Atilio Miguel Cruz',
        'cargo_responsable': 'Responsable',
        'color': '#047857',
        'descripcion': 'Rendición de cuentas, balances y registraciones contables.'
    },
    {
        'id': 'presupuesto',
        'nombre': 'Registro y Control Presupuestario',
        'nivel': 2,
        'tipo': 'Área Operativa',
        'parent_id': 'coord-adm',
        'responsable': 'Marcelo Rubén Jorqui',
        'cargo_responsable': 'Responsable',
        'color': '#15803d',
        'descripcion': 'Seguimiento presupuestario, imputaciones preventivas y definitivas.'
    },
    {
        'id': 'tesoreria',
        'nombre': 'Tesorería',
        'nivel': 2,
        'tipo': 'Área Operativa',
        'parent_id': 'coord-adm',
        'responsable': 'María Evangelina Garramuño',
        'cargo_responsable': 'Responsable',
        'color': '#16a34a',
        'descripcion': 'Gestión de fondos, pagos, cuentas bancarias y caja chica.'
    },
    {
        'id': 'mantenimiento',
        'nombre': 'Mantenimiento y Servicios Generales',
        'nivel': 2,
        'tipo': 'Área Operativa',
        'parent_id': 'coord-adm',
        'responsable': 'Juan Carlos Aguirre',
        'cargo_responsable': 'Responsable',
        'color': '#b45309',
        'descripcion': 'Mantenimiento edilicio, parque automotor e infraestructura física.'
    },
    # Dirección de Niñez, Adolescencia y Familia
    {
        'id': 'dir-ninez',
        'nombre': 'Dirección de Niñez, Adolescencia y Familia',
        'nivel': 1,
        'tipo': 'Dirección Provincial',
        'parent_id': 'sec-snaf',
        'responsable': 'Dra. Mariela Angélica Gloss',
        'cargo_responsable': 'Directora (Jerárquico)',
        'color': '#0284c7',
        'descripcion': 'Dirección de medidas de protección integral, intervenciones de restitución y red territorial.'
    },
    {
        'id': 'despacho-ninez',
        'nombre': 'Despacho Niñez',
        'nivel': 2,
        'tipo': 'Área Operativa',
        'parent_id': 'dir-ninez',
        'responsable': 'Dra. Mariela Angélica Gloss',
        'cargo_responsable': 'Supervisión Directa',
        'color': '#38bdf8',
        'descripcion': 'Trámite interno de expedientes y dictámenes de la Dirección de Niñez.'
    },
    {
        'id': 'linea-102',
        'nombre': 'Coordinación Línea 102',
        'nivel': 2,
        'tipo': 'Coordinación Especializada',
        'parent_id': 'dir-ninez',
        'responsable': 'Judith Noelia Forero',
        'cargo_responsable': 'Coordinadora (Jerárquico)',
        'color': '#f59e0b',
        'descripcion': 'Servicio telefónico gratuito de atención y recepción de denuncias las 24 horas.'
    },
    {
        'id': 'linea-102-administracion',
        'nombre': 'Área Administrativa (Línea 102)',
        'nivel': 3,
        'tipo': 'Área Operativa',
        'parent_id': 'linea-102',
        'responsable': 'Nora Mabel Noblega',
        'cargo_responsable': 'Responsable Administrativa',
        'color': '#0284c7',
        'descripcion': 'Gestión documental, archivo de expedientes, registro estadístico de llamadas y soporte operativo interno.'
    },
    {
        'id': 'linea-102-operadores',
        'nombre': 'Cuerpo de Operadores / Guardia Telefónica (Línea 102)',
        'nivel': 3,
        'tipo': 'Área Operativa',
        'parent_id': 'linea-102',
        'responsable': 'Guardia Telefónica 24 Hs',
        'cargo_responsable': 'Operadores Telefónicos de Emergencia',
        'color': '#f59e0b',
        'descripcion': 'Atención telefónica permanente las 24 horas, recepción de denuncias y despacho de urgencias.'
    },
    {
        'id': 'linea-102-equipo-tecnico',
        'nombre': 'Equipo Técnico Interdisciplinario (Línea 102)',
        'nivel': 3,
        'tipo': 'Área Técnica',
        'parent_id': 'linea-102',
        'responsable': 'Equipo Interdisciplinario',
        'cargo_responsable': 'Atención e Intervención en Crisis',
        'color': '#059669',
        'descripcion': 'Intervenciones interdisciplinarias, contención psicosocial, evaluaciones de riesgo y articulación con OPDs.'
    },
    {
        'id': 'coord-entornos',
        'nombre': 'Coordinación de Entornos Digitales y Sociales',
        'nivel': 2,
        'tipo': 'Coordinación Especializada',
        'parent_id': 'dir-ninez',
        'responsable': 'Rebeca Raquel Juárez Orieta',
        'cargo_responsable': 'Coordinadora (Jerárquico)',
        'color': '#6366f1',
        'descripcion': 'Abordaje de problemáticas en entornos virtuales (grooming, ciberbullying, ludopatía digital).'
    },
    {
        'id': 'coord-opd',
        'nombre': 'Coordinación OPD (Oficinas de Protección de Derechos)',
        'nivel': 2,
        'tipo': 'Coordinación Territorial',
        'parent_id': 'dir-ninez',
        'responsable': 'Hermelinda Delia Alancay',
        'cargo_responsable': 'Coordinadora (Jerárquico)',
        'color': '#0ea5e9',
        'descripcion': 'Articulación técnica, operativa y jurídica de las 30 Oficinas de Protección en toda la provincia.'
    },
    {
        'id': 'oficinas-opd',
        'nombre': 'Oficinas de Protección de Derechos (OPD)',
        'nivel': 3,
        'tipo': 'Red de Dispositivos Territoriales',
        'parent_id': 'coord-opd',
        'responsable': 'Dra. Delia Alancay',
        'cargo_responsable': 'Coordinadora Provincial de OPDs',
        'color': '#0284c7',
        'descripcion': 'Red territorial provincial de las 30 Oficinas de Protección de Derechos (OPD) distribuidas en toda la provincia.'
    },
    {
        'id': 'despacho-coord-opd',
        'nombre': 'Despacho Coord. OPD',
        'nivel': 3,
        'tipo': 'Área Operativa',
        'parent_id': 'coord-opd',
        'responsable': 'Dra. Delia Alancay',
        'cargo_responsable': 'Despacho de Coordinación',
        'color': '#7dd3fc',
        'descripcion': 'Despacho administrativo y seguimiento documental de la red de 30 OPDs.'
    },
    # Dirección Provincial de Dispositivos de Cuidados
    {
        'id': 'dir-dispositivos',
        'nombre': 'Dirección Provincial de Dispositivos de Cuidados',
        'nivel': 1,
        'tipo': 'Dirección Provincial',
        'parent_id': 'sec-snaf',
        'responsable': 'Lic. Mario Vacaflor',
        'cargo_responsable': 'Director Provincial (Jerárquico)',
        'color': '#7c3aed',
        'descripcion': 'Supervisión de residencias, CDIs, CDDs, programas de acogimiento y sistema penal juvenil.'
    },
    {
        'id': 'despacho-dpdc',
        'nombre': 'Despacho DPDC',
        'nivel': 2,
        'tipo': 'Área Operativa',
        'parent_id': 'dir-dispositivos',
        'responsable': 'Lic. Mario Vacaflor',
        'cargo_responsable': 'Director Provincial',
        'color': '#a855f7',
        'descripcion': 'Gestión de expedientes y resoluciones de dispositivos de cuidados.'
    },
    {
        'id': 'sede-dpdc',
        'nombre': 'SEDE DPDC',
        'nivel': 3,
        'tipo': 'Área Operativa',
        'parent_id': 'disp-cuidado-comunitario',
        'responsable': 'Lic. Mario Vacaflor',
        'cargo_responsable': 'Director Provincial',
        'color': '#9333ea',
        'descripcion': 'Equipo operativo y de sede de los Dispositivos de Desarrollo y Cuidado Comunitario.'
    },
    # Sistema de Cuidados Alternativos
    {
        'id': 'sist-cuidados-alternativos',
        'nombre': 'Sistema de Cuidados Alternativos',
        'nivel': 2,
        'tipo': 'Sistema Especializado',
        'parent_id': 'dir-dispositivos',
        'responsable': 'Lic. Mario Vacaflor',
        'cargo_responsable': 'Dirección Provincial de Dispositivos',
        'color': '#be185d',
        'descripcion': 'Sistema integral de modalidades alternativas de cuidado y protección: familiar y residencial.'
    },
    {
        'id': 'cuidados-modalidad-familiar',
        'nombre': 'Modalidades Familiares',
        'nivel': 3,
        'tipo': 'Modalidad de Cuidado',
        'parent_id': 'sist-cuidados-alternativos',
        'responsable': 'Lic. Mario Vacaflor',
        'cargo_responsable': 'Supervisión Técnica',
        'color': '#c026d3',
        'descripcion': 'Medidas de protección bajo modalidades familiares: Familia Ampliada y Familias que Cuidan.'
    },
    {
        'id': 'prog-familia-ampliada',
        'nombre': 'Programa Familia Ampliada',
        'nivel': 4,
        'tipo': 'Programa',
        'parent_id': 'cuidados-modalidad-familiar',
        'responsable': 'Lic. Mario Vacaflor',
        'cargo_responsable': 'Supervisión Directa',
        'color': '#c026d3',
        'descripcion': 'Acompañamiento a niños y adolescentes bajo cuidado de familiares directos o extensos.'
    },
    {
        'id': 'prog-familias-cuidan',
        'nombre': 'Programa Familias que Cuidan',
        'nivel': 4,
        'tipo': 'Programa',
        'parent_id': 'cuidados-modalidad-familiar',
        'responsable': 'Lic. Mario Vacaflor',
        'cargo_responsable': 'Supervisión Directa',
        'color': '#db2777',
        'descripcion': 'Red de familias de acogimiento temporal y cuidado transitorio sin fines adoptivos.'
    },
    {
        'id': 'cuidados-modalidad-residencial',
        'nombre': 'Modalidad Residencial',
        'nivel': 3,
        'tipo': 'Modalidad de Cuidado',
        'parent_id': 'sist-cuidados-alternativos',
        'responsable': 'Lic. Mario Vacaflor',
        'cargo_responsable': 'Supervisión Institucional',
        'color': '#e11d48',
        'descripcion': 'Dispositivos de alojamiento y residencias de cuidado institucional.'
    },
    {
        'id': 'coord-casa-nino',
        'nombre': 'Casa del Niño y la Niña',
        'nivel': 4,
        'tipo': 'Dispositivo Residencial',
        'parent_id': 'cuidados-modalidad-residencial',
        'responsable': 'Gabriel Guillermo Quispe',
        'cargo_responsable': 'Coordinador / Responsable',
        'color': '#e11d48',
        'descripcion': 'Institución de alojamiento y contención integral para primera y segunda infancia.'
    },
    {
        'id': 'coord-casa-adolescente',
        'nombre': 'Casa del Adolescente',
        'nivel': 4,
        'tipo': 'Dispositivo Residencial',
        'parent_id': 'cuidados-modalidad-residencial',
        'responsable': 'Hilda Del Pilar Prolongo',
        'cargo_responsable': 'Coordinadora / Responsable',
        'color': '#be123c',
        'descripcion': 'Residencia institucional y acompañamiento socioeducativo para adolescentes.'
    },
    # Dispositivos de Desarrollo y Cuidado Comunitario (Agrupa CDIs y CDDs)
    {
        'id': 'disp-cuidado-comunitario',
        'nombre': 'Dispositivos de Desarrollo y Cuidado Comunitario',
        'nivel': 2,
        'tipo': 'Coordinación de Dispositivos',
        'parent_id': 'dir-dispositivos',
        'responsable': 'Lic. Mario Vacaflor',
        'cargo_responsable': 'Supervisión General / Equipo de Coordinación',
        'color': '#059669',
        'descripcion': 'Coordinación técnica, supervisión y gestión de los 7 Centros de Desarrollo Infantil (CDI) y 2 Centros de Día (CDD) de la provincia.'
    },
    {
        'id': 'cdi-herminio-arrieta',
        'nombre': 'C.D.I. Herminio Arrieta',
        'nivel': 3,
        'tipo': 'Centro de Desarrollo Infantil',
        'parent_id': 'disp-cuidado-comunitario',
        'responsable': 'Jimena Daniela Serapio',
        'cargo_responsable': 'Responsable',
        'color': '#475569',
        'descripcion': 'Centro de atención integral temprana para la primera infancia.'
    },
    {
        'id': 'cdi-guillermo-snopek',
        'nombre': 'C.D.I. Guillermo Snopek',
        'nivel': 3,
        'tipo': 'Centro de Desarrollo Infantil',
        'parent_id': 'disp-cuidado-comunitario',
        'responsable': 'Adrián Fernando Castro',
        'cargo_responsable': 'Responsable',
        'color': '#475569',
        'descripcion': 'Centro de atención integral temprana para la primera infancia.'
    },
    {
        'id': 'cdi-eva-peron',
        'nombre': 'C.D.I. Eva Perón',
        'nivel': 3,
        'tipo': 'Centro de Desarrollo Infantil',
        'parent_id': 'disp-cuidado-comunitario',
        'responsable': 'Nélida Alejandra San Roque',
        'cargo_responsable': 'Responsable',
        'color': '#475569',
        'descripcion': 'Centro de atención integral temprana para la primera infancia.'
    },
    {
        'id': 'cdi-san-jose',
        'nombre': 'C.D.I. San José (Perico)',
        'nivel': 3,
        'tipo': 'Centro de Desarrollo Infantil',
        'parent_id': 'disp-cuidado-comunitario',
        'responsable': 'Marcela Ivana Tejerina',
        'cargo_responsable': 'Responsable',
        'color': '#475569',
        'descripcion': 'Centro de atención integral temprana para la primera infancia en Perico.'
    },
    {
        'id': 'cdi-santa-cecilia',
        'nombre': 'C.D.I. Santa Cecilia',
        'nivel': 3,
        'tipo': 'Centro de Desarrollo Infantil',
        'parent_id': 'disp-cuidado-comunitario',
        'responsable': 'Graciela Mabel Martínez',
        'cargo_responsable': 'Responsable',
        'color': '#475569',
        'descripcion': 'Centro de atención integral temprana para la primera infancia.'
    },
    {
        'id': 'cdi-pequeno-mundo',
        'nombre': 'C.D.I. Mi Pequeño Mundo',
        'nivel': 3,
        'tipo': 'Centro de Desarrollo Infantil',
        'parent_id': 'disp-cuidado-comunitario',
        'responsable': 'Nora Lucía Leañez',
        'cargo_responsable': 'Responsable',
        'color': '#475569',
        'descripcion': 'Centro de atención integral temprana para la primera infancia.'
    },
    {
        'id': 'cdi-rio-blanco',
        'nombre': 'C.D.I. Nuestra Señora de Río Blanco',
        'nivel': 3,
        'tipo': 'Centro de Desarrollo Infantil',
        'parent_id': 'disp-cuidado-comunitario',
        'responsable': 'Silvia Raquel Sajama',
        'cargo_responsable': 'Responsable',
        'color': '#475569',
        'descripcion': 'Centro de atención integral temprana para la primera infancia.'
    },
    {
        'id': 'cdd-sol-para-todos',
        'nombre': 'C.D.D. Sol Para Todos',
        'nivel': 3,
        'tipo': 'Centro de Día',
        'parent_id': 'disp-cuidado-comunitario',
        'responsable': 'Daniel Osvaldo Sánchez',
        'cargo_responsable': 'Responsable',
        'color': '#475569',
        'descripcion': 'Centro de día con actividades formativas y nutricionales.'
    },
    {
        'id': 'cdd-vocecitas-punenas',
        'nombre': 'C.D.D. Vocecitas Puneñas (La Quiaca)',
        'nivel': 3,
        'tipo': 'Centro de Día',
        'parent_id': 'disp-cuidado-comunitario',
        'responsable': 'Cristian David Quiroga',
        'cargo_responsable': 'Responsable',
        'color': '#475569',
        'descripcion': 'Centro de día para niños y adolescentes en La Quiaca.'
    },
    # Responsabilidad Penal Juvenil
    {
        'id': 'sistema-penal-juvenil',
        'nombre': 'Sistema de Responsabilidad Penal Juvenil',
        'nivel': 2,
        'tipo': 'Sistema Especializado',
        'parent_id': 'dir-dispositivos',
        'responsable': 'Nancy Noemi Alancay',
        'cargo_responsable': 'Responsable',
        'color': '#b91c1c',
        'descripcion': 'Abordaje integral, medidas socioeducativas y dispositivos penales juveniles.'
    },
    {
        'id': 'penal-no-privativas',
        'nombre': 'Medidas No privativas de Libertad',
        'nivel': 3,
        'tipo': 'Modalidad Penal Juvenil',
        'parent_id': 'sistema-penal-juvenil',
        'responsable': 'Nancy Noemi Alancay',
        'cargo_responsable': 'Supervisión Medidas No Privativas',
        'color': '#7f1d1d',
        'descripcion': 'Modalidad de medidas no privativas de libertad, abordaje en territorio y prevención comunitaria.'
    },
    {
        'id': 'dappa',
        'nombre': 'Dispositivo de Acompañamiento Preventivo y Promocional para Adolescentes DAPPA',
        'nivel': 4,
        'tipo': 'Dispositivo Penal Juvenil',
        'parent_id': 'penal-no-privativas',
        'responsable': 'Carreras Romina Avila',
        'cargo_responsable': 'Responsable',
        'color': '#7f1d1d',
        'descripcion': 'Dispositivo de prevención, reinserción y acompañamiento promocional para adolescentes.'
    },
    {
        'id': 'mpt',
        'nombre': 'Medidas Penales en Territorio MPT',
        'nivel': 4,
        'tipo': 'Dispositivo Penal Juvenil',
        'parent_id': 'penal-no-privativas',
        'responsable': 'Victor Jose Augusto Rizzello',
        'cargo_responsable': 'Responsable',
        'color': '#7f1d1d',
        'descripcion': 'Seguimiento comunitario y en territorio de medidas penales alternativas no privativas.'
    },
    {
        'id': 'penal-privativas',
        'nombre': 'Medidas Privativas de Libertad',
        'nivel': 3,
        'tipo': 'Modalidad Penal Juvenil',
        'parent_id': 'sistema-penal-juvenil',
        'responsable': 'Nancy Noemi Alancay',
        'cargo_responsable': 'Supervisión Medidas Privativas',
        'color': '#991b1b',
        'descripcion': 'Modalidad de medidas privativas de libertad, centros de internación y régimen cerrado.'
    },
    {
        'id': 'cad',
        'nombre': 'Centro de Admisión y Derivación C.A.D.',
        'nivel': 4,
        'tipo': 'Dispositivo Penal Juvenil',
        'parent_id': 'penal-privativas',
        'responsable': 'Zerpa Noelia Roxana Aguilar',
        'cargo_responsable': 'Responsable',
        'color': '#991b1b',
        'descripcion': 'Admisión, evaluación inicial y derivación inmediata de jóvenes en conflicto con la ley.'
    },
    {
        'id': 'centro-san-pedro',
        'nombre': 'CENTRO SOCIO EDUCATIVO SAN PEDRO',
        'nivel': 5,
        'tipo': 'Centro Socio Educativo',
        'parent_id': 'cad',
        'responsable': 'Silvia Raquel Cardozo',
        'cargo_responsable': 'Responsable',
        'color': '#991b1b',
        'descripcion': 'Centro socioeducativo de cumplimiento de medidas en el departamento San Pedro.'
    },
    {
        'id': 'centro-alto-comedero',
        'nombre': 'CENTRO SOCIO EDUCATIVO ALTO COMEDERO',
        'nivel': 5,
        'tipo': 'Centro Socio Educativo',
        'parent_id': 'cad',
        'responsable': 'Victor Jose Augusto Rizzello',
        'cargo_responsable': 'Responsable',
        'color': '#991b1b',
        'descripcion': 'Centro socioeducativo para cumplimiento de medidas privativas en Alto Comedero.'
    },
    {
        'id': 'pae',
        'nombre': 'Programa de Acompañamiento al Egreso (PAE)',
        'nivel': 2,
        'tipo': 'Programa Especial',
        'parent_id': 'dir-dispositivos',
        'responsable': 'Ana Cecilia Gareca',
        'cargo_responsable': 'Responsable',
        'color': '#831843',
        'descripcion': 'Acompañamiento técnico y tutoría para jóvenes en transición hacia la vida autónoma.'
    },
    # Dirección de Juventud
    ]

# Region mapping for 30 OPDs
regions = {
    1: 'Puna', 2: 'Puna', 3: 'Quebrada', 4: 'Quebrada', 5: 'Quebrada',
    6: 'Valles', 7: 'Valles', 8: 'Valles', 9: 'Valles', 10: 'Valles',
    11: 'Valles', 12: 'Valles', 13: 'Ramal / Yungas', 14: 'Ramal / Yungas',
    15: 'Ramal / Yungas', 16: 'Ramal / Yungas', 17: 'Ramal / Yungas', 18: 'Ramal / Yungas',
    19: 'Valles (Capital)', 20: 'Valles (Capital)', 21: 'Valles (Capital)', 22: 'Valles (Capital)',
    23: 'Valles (Capital)', 24: 'Valles (Capital)', 25: 'Ramal / Yungas', 26: 'Ramal / Yungas',
    27: 'Ramal / Yungas', 28: 'Valles (Capital)', 29: 'Valles', 30: 'Ramal / Yungas'
}

# Add all 30 OPDs to sectors_catalog
for num in range(1, 31):
    sum_data = opd_summary.get(num, {})
    nombre = sum_data.get('nombre', f'OPD {num}')
    opd_id = f'opd-{num:02d}'
    sectors_catalog.append({
        'id': opd_id,
        'num_opd': num,
        'nombre': f'OPD {num:02d} - {nombre}',
        'nivel': 4,
        'tipo': 'Oficina de Protección de Derechos',
        'parent_id': 'oficinas-opd',
        'region': regions.get(num, 'Provincial'),
        'responsable': sum_data.get('abogado_resumen', 'Equipo Interdisciplinario'),
        'cargo_responsable': 'Asesor Legal / Equipo Titular',
        'color': '#0284c7',
        'direccion': sum_data.get('direccion', ''),
        'horario': sum_data.get('horario', 'Lunes a Viernes 7:00 a 13:00'),
        'telefono_guardia': sum_data.get('telefono_guardia', ''),
        'cobertura': sum_data.get('cobertura', ''),
        'descripcion': f'Atención territorial descentralizada en {nombre} y zonas de influencia.'
    })

print(f'Total sectors in catalog: {len(sectors_catalog)}')

# Function to map text sector name to sector_id
def map_sector_to_id(rep, sec_text):
    sec = (sec_text or '').strip().lower()
    rep = (rep or '').strip().lower()
    
    if 'secretaria privada' in sec: return 'sec-privada'
    if 'privada gestion' in sec: return 'privada-adm'
    if 'secretaria' in sec and 'general' not in sec and 'privada' not in sec: return 'sec-snaf'
    if 'despacho coord. opd' in sec: return 'despacho-coord-opd'
    if 'despacho niñez' in sec or 'despacho ninez' in sec: return 'despacho-ninez'
    if 'despacho dpdc' in sec: return 'despacho-dpdc'
    if 'despacho' in sec: return 'despacho-general'
    if 'mesa de entrada' in sec: return 'mesa-entrada'
    if 'recursos humanos' in sec: return 'rrhh'
    if 'informatica' in sec or 'sistemas' in sec: return 'informatica'
    if 'prensa' in sec: return 'prensa'
    if 'planificacion' in sec or 'capacitacion' in sec: return 'planificacion'
    if 'promocion' in sec: return 'coord-promocion'
    if 'coordinacion de gestion administrativa' in sec: return 'coord-adm'
    if 'compras' in sec: return 'compras'
    if 'contable' in sec: return 'info-contable'
    if 'presupuestario' in sec: return 'presupuesto'
    if 'tesoreria' in sec: return 'tesoreria'
    if 'mantenimiento' in sec: return 'mantenimiento'
    
    if 'directora de niñez' in sec or 'direccion de niñez' in sec: return 'dir-ninez'
    if 'linea 102' in sec: return 'linea-102'
    if 'entornos' in sec or 'digitales' in sec: return 'coord-entornos'
    if 'coordinacion opd' in sec: return 'coord-opd'
    
    if 'director provincial de dispositivos' in sec or 'direccion provincial de dispositivos' in sec: return 'dir-dispositivos'
    if 'sede' in sec and 'dispositivos' in rep: return 'sede-dpdc'
    if 'familia ampliada' in sec: return 'prog-familia-ampliada'
    if 'familias que cuidan' in sec: return 'prog-familias-cuidan'
    if 'casa del niño' in sec: return 'coord-casa-nino'
    if 'casa del adolescente' in sec: return 'coord-casa-adolescente'
    
    if 'herminio arrieta' in sec: return 'cdi-herminio-arrieta'
    if 'guillermo snopek' in sec and 'cdi' in sec: return 'cdi-guillermo-snopek'
    if 'eva peron' in sec and 'cdi' in sec: return 'cdi-eva-peron'
    if 'san josé' in sec or 'san jose' in sec: return 'cdi-san-jose'
    if 'santa cecilia' in sec and 'cdi' in sec: return 'cdi-santa-cecilia'
    if 'pequeño mundo' in sec or 'pequeno mundo' in sec: return 'cdi-pequeno-mundo'
    if 'rio blanco' in sec: return 'cdi-rio-blanco'
    if 'sol para todos' in sec and 'c.d.d' in sec: return 'cdd-sol-para-todos'
    if 'vocecitas' in sec: return 'cdd-vocecitas-punenas'
    
    if 'penal juvenil' in sec: return 'sistema-penal-juvenil'
    if 'centro de admisión' in sec or 'c.a.d' in sec: return 'cad'
    if 'san pedro' in sec and ('socio educativo' in sec or 'penal' in rep): return 'centro-san-pedro'
    if 'medidas penales' in sec or 'mpt' in sec: return 'mpt'
    if 'dappa' in sec: return 'dappa'
    if 'egreso' in sec or 'pae' in sec: return 'pae'
    
    if 'juventud' in sec or 'juventud' in rep: return 'dir-juventud'
    
    # OPD checks
    opd_match = re.search(r'opd\s*0?(\d+)', sec)
    if opd_match:
        num = int(opd_match.group(1))
        if 1 <= num <= 30: return f'opd-{num:02d}'
        
    return 'sec-snaf'

# Map OPD numbers directly
def get_opd_id_by_num(num):
    return f'opd-{int(num):02d}'

# Now let's consolidate personnel
personnel_dict = {} # key: CUIL or 'NAME:Apellidos, Nombres'

def get_person_key(cuil, ape, nom):
    c = str(cuil).strip() if cuil and str(cuil).strip() not in ('-', 'None', '') else None
    if c:
        return f'CUIL:{c}'
    norm_name = f'{ape or ""}_{nom or ""}'.upper().replace(' ', '').replace('Á','A').replace('É','E').replace('Í','I').replace('Ó','O').replace('Ú','U').replace('Ü','U')
    return f'NAME:{norm_name}'

# 1. Parse Definitivo_General (SNAF)
s_gen = wb1['Definitivo_General']
for r in list(s_gen.iter_rows(values_only=True))[1:]:
    if not r[4] and not r[5]: continue
    num, cuil, user_gde, email, ape, nom, rep, sec, func, sup, carat, asig, cap, mod, calif, asist, obs = r
    cuil_str = str(cuil).strip() if cuil and str(cuil).strip() not in ('-', 'None') else ''
    key = get_person_key(cuil_str, ape, nom)
    sec_id = map_sector_to_id(rep, sec)
    
    role = {
        'sector_id': sec_id,
        'sector_nombre': sec or 'SNAF',
        'reparticion': rep or 'Secretaría de Niñez, Adolescencia y Familia',
        'funcion': str(func).strip() if func else 'ADMINISTRATIVO',
        'condicion': 'Titular' if 'Jerarquico' not in str(func) and 'Responsable' not in str(func) else 'Responsable / Jerárquico',
        'superior_inmediato': str(sup).strip() if sup else '',
        'observaciones': str(obs).strip() if obs else ''
    }
    
    personnel_dict[key] = {
        'id': key.replace(':', '_'),
        'cuil': cuil_str,
        'usuario_gde': str(user_gde).strip() if user_gde and str(user_gde).strip() != '-' else '',
        'correo': str(email).strip() if email else '',
        'apellidos': str(ape).strip() if ape else '',
        'nombres': str(nom).strip() if nom else '',
        'telefono': '',
        'profesion': '',
        'matricula': '',
        'sit_revista': 'Planta / Contrato',
        'horario': 'Lunes a Viernes 7:00 a 13:00',
        'caratulador': True if carat and str(carat).strip().upper() == 'X' else False,
        'asignador': True if asig and str(asig).strip().upper() == 'X' else False,
        'capacitacion_gde': str(cap).strip().upper() if cap else 'NO',
        'modalidad_capacitacion': str(mod).strip() if mod and str(mod).strip() != '-' else '',
        'calificaciones_virtual': str(calif).strip() if calif and str(calif).strip() != '-' else '',
        'asistencia_presencial': str(asist).strip() if asist and str(asist).strip() != '-' else '',
        'observaciones_generales': str(obs).strip() if obs else '',
        'sectores': [role]
    }

print(f'Parsed SNAF General: {len(personnel_dict)} agents')

# 2. Parse Nomina_General_OPD
# Total agents after Nomina OPD: {len(personnel_dict)}')

# 4. Check Cobertura_Legal_Itinerante to make sure any itinerant sectors are registered
s_itinerante = wb2['Cobertura_Legal_Itinerante']
for r in list(s_itinerante.iter_rows(values_only=True))[1:]:
    if not r[1]: continue
    num, abog_name, mat, cuil, base_opd, cubre_opd, hor, tel, email, obs, mod, grp = r
    cuil_str = str(cuil).strip() if cuil and str(cuil).strip() not in ('-', 'None') else ''
    # Match person
    found_key = None
    if cuil_str:
        k = f'CUIL:{cuil_str}'
        if k in personnel_dict: found_key = k
    if not found_key:
        # Match by name
        norm_abog = str(abog_name).upper().replace(' ', '').replace(',','')
        for k, p in personnel_dict.items():
            full = (p['apellidos'] + p['nombres']).upper().replace(' ', '').replace(',','')
            if norm_abog in full or full in norm_abog:
                found_key = k
                break
                
    if found_key:
        p = personnel_dict[found_key]
        if mat and str(mat).strip() != '-' and not p['matricula']: p['matricula'] = str(mat).strip()
        if tel and str(tel).strip() != '-' and not p['telefono']: p['telefono'] = str(tel).strip()
        if email and not p['correo']: p['correo'] = str(email).strip()
        
        # Check cubre_opd (e.g. '07 - Palpalá', '13 - Centro Integral San Pedro', '08 - Perico')
        if cubre_opd and 'Sin itinerancia' not in str(cubre_opd):
            # Extract OPD numbers
            opd_nums = re.findall(r'(\d+)', str(cubre_opd))
            for opd_n in opd_nums:
                target_opd_num = int(opd_n)
                target_sec_id = f'opd-{target_opd_num:02d}'
                # check if already has this sector
                if not any(s['sector_id'] == target_sec_id for s in p['sectores']):
                    opd_name = opd_summary.get(target_opd_num, {}).get('nombre', f'OPD {target_opd_num}')
                    p['sectores'].append({
                        'sector_id': target_sec_id,
                        'sector_nombre': f'OPD {target_opd_num:02d} - {opd_name}',
                        'reparticion': 'Dirección de Niñez, Adolescencia y Familia (Red OPD)',
                        'funcion': 'Abogado Itinerante (BIS)',
                        'condicion': 'Itinerante (BIS)',
                        'superior_inmediato': 'Hermelinda Delia Alancay (Coord. OPD)',
                        'observaciones': f'Cubre como itinerante (BIS). Base en {base_opd}. {obs or ""}'
                    })

# 5. Process Casos_a_Confirmar updates
s_casos = wb2['Casos_a_Confirmar']
for r in list(s_casos.iter_rows(values_only=True))[1:]:
    if not r[1]: continue
    num, agente, prof, mat, email, estado, det = r
    # Find or add
    agente_str = str(agente).strip()
    found_key = None
    for k, p in personnel_dict.items():
        full = (p['apellidos'] + ', ' + p['nombres']).upper()
        if agente_str.upper() in full or full in agente_str.upper():
            found_key = k
            break
            
    if found_key:
        p = personnel_dict[found_key]
        if prof and not p['profesion']: p['profesion'] = str(prof).strip()
        if mat and str(mat).strip() != '-' and not p['matricula']: p['matricula'] = str(mat).strip()
        if email and str(email).strip() != '-' and not p['correo']: p['correo'] = str(email).strip()
        if det: p['observaciones_generales'] = (p['observaciones_generales'] + ' | ' + str(det)).strip(' |')
    else:
        # e.g. BRUNO, ARIEL or HUANCO LOAYZA
        parts = agente_str.split(',')
        ape = parts[0].strip() if len(parts) > 0 else agente_str
        nom = parts[1].strip() if len(parts) > 1 else ''
        key = get_person_key('', ape, nom)
        target_opd = 'opd-19' if '19' in str(estado) else ('opd-20' if '20' in str(estado) else 'sec-snaf')
        personnel_dict[key] = {
            'id': key.replace(':', '_'),
            'cuil': '',
            'usuario_gde': '',
            'correo': str(email).strip() if email and str(email).strip() != '-' else '',
            'apellidos': ape,
            'nombres': nom,
            'telefono': '',
            'profesion': str(prof).strip() if prof else 'Servicios Generales',
            'matricula': str(mat).strip() if mat and str(mat).strip() != '-' else '',
            'sit_revista': 'Contrato',
            'horario': 'Lunes a Viernes 7:00 a 13:00',
            'caratulador': False,
            'asignador': False,
            'capacitacion_gde': 'NO',
            'modalidad_capacitacion': '',
            'calificaciones_virtual': '',
            'asistencia_presencial': '',
            'observaciones_generales': str(det).strip() if det else str(estado),
            'sectores': [{
                'sector_id': target_opd,
                'sector_nombre': 'OPD ' + target_opd.replace('opd-', ''),
                'reparticion': 'Dirección de Niñez, Adolescencia y Familia (Red OPD)',
                'funcion': str(prof).strip() if prof else 'Servicios Generales',
                'condicion': 'Titular',
                'superior_inmediato': 'Coord. OPD',
                'observaciones': str(det).strip() if det else ''
            }]
        }

# Flag multi-sector agents
multi_sector_count = 0
for k, p in personnel_dict.items():
    p['is_multi_sector'] = len(p['sectores']) > 1
    if p['is_multi_sector']:
        multi_sector_count += 1

print(f'Total unified agents: {len(personnel_dict)}')
print(f'Total agents with multiple sectors: {multi_sector_count}')

# Convert personnel dict to sorted list
personnel_list = sorted(list(personnel_dict.values()), key=lambda x: (x['apellidos'], x['nombres']))

# Desired order of sector IDs matching Organigrama_Oficial_SNAF.png
ordered_ids = [
    'sec-snaf',
    'despacho-general', 'despacho-tramite', 'mesa-entrada', 'sec-privada',
    'dir-ninez', 'despacho-ninez', 'linea-102',
    'linea-102-equipo-tecnico', 'linea-102-operadores', 'linea-102-administracion',
    'coord-promocion', 'coord-entornos', 'coord-opd', 'oficinas-opd', 'despacho-coord-opd',
    'opd-01', 'opd-02', 'opd-03', 'opd-04', 'opd-05',
    'opd-06', 'opd-07', 'opd-08', 'opd-09', 'opd-10',
    'opd-11', 'opd-12', 'opd-13', 'opd-14', 'opd-15',
    'opd-16', 'opd-17', 'opd-18', 'opd-19', 'opd-20',
    'opd-21', 'opd-22', 'opd-23', 'opd-24', 'opd-25',
    'opd-26', 'opd-27', 'opd-28', 'opd-29', 'opd-30',
    'rrhh', 'informatica', 'prensa', 'planificacion',
    'coord-adm', 'privada-adm', 'compras', 'presupuesto', 'info-contable', 'tesoreria', 'mantenimiento',
    'dir-dispositivos', 'despacho-dpdc',
    'sist-cuidados-alternativos', 'cuidados-modalidad-familiar', 'prog-familia-ampliada', 'prog-familias-cuidan',
    'cuidados-modalidad-residencial', 'coord-casa-nino', 'coord-casa-adolescente',
    'disp-cuidado-comunitario', 'sede-dpdc',
    'cdi-herminio-arrieta', 'cdi-guillermo-snopek', 'cdi-eva-peron', 'cdi-san-jose',
    'cdi-santa-cecilia', 'cdi-pequeno-mundo', 'cdi-rio-blanco',
    'cdd-sol-para-todos', 'cdd-vocecitas-punenas',
    'sistema-penal-juvenil', 'penal-no-privativas', 'dappa', 'mpt',
    'penal-privativas', 'cad', 'centro-san-pedro', 'centro-alto-comedero',
    'pae'
]
sec_map = {s['id']: s for s in sectors_catalog}
ordered_catalog = [sec_map[sid] for sid in ordered_ids if sid in sec_map]

# Output data
final_data = {
    'institucion': {
        'nombre': 'Secretaría de Niñez, Adolescencia y Familia',
        'sigla': 'SNAF',
        'ministerio': 'Ministerio de Desarrollo Humano',
        'provincia': 'Provincia de Jujuy',
        'autoridad_maxima': 'Dra. Marta Laura Iriarte Duberti',
        'cargo_autoridad': 'Secretaria de Niñez, Adolescencia y Familia',
        'fecha_actualizacion': 'Octubre 2026'
    },
    'sectores': ordered_catalog,
    'personal': personnel_list
}

with open(r'E:\datos\Documentos\proyectoOrganigrama\data.json', 'w', encoding='utf-8') as f:
    json.dump(final_data, f, ensure_ascii=False, indent=2)

with open(r'E:\datos\Documentos\proyectoOrganigrama\initialData.js', 'w', encoding='utf-8') as f:
    f.write('window.INITIAL_ORGANIGRAMA_DATA = ')
    json.dump(final_data, f, ensure_ascii=False, indent=2)
    f.write(';\n')

print('Successfully exported data.json and initialData.js!')
