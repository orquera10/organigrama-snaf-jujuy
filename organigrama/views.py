import json
from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import OrganigramaState

def login_view(request):
    """
    Controlador de inicio de sesión seguro para el sistema SNAF.
    Redirige según el rol:
    - dorquera (Admin): acceso total a Gestión y Organigrama.
    - miriarte (Estándar): acceso exclusivo a Organigrama (consulta).
    """
    if request.user.is_authenticated:
        next_url = request.GET.get('next')
        if next_url:
            return redirect(next_url)
        if request.user.is_staff or request.user.is_superuser:
            return redirect('gestion')
        return redirect('organigrama')

    error_message = None
    submitted_username = ''
    next_url = request.POST.get('next') or request.GET.get('next', '')

    if request.method == 'POST':
        submitted_username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        user = authenticate(request, username=submitted_username, password=password)
        if user is not None:
            login(request, user)
            
            # Redirección inteligente post-login
            if next_url and next_url != '/login/':
                # Si el usuario no es admin y quiso ingresar a gestión, redirigir con aviso
                if 'gestion' in next_url and not (user.is_staff or user.is_superuser):
                    return redirect('/organigrama/?denied=1')
                return redirect(next_url)

            # Redirección por defecto según rol
            if user.is_staff or user.is_superuser:
                return redirect('gestion')
            return redirect('organigrama')
        else:
            error_message = 'Usuario o contraseña incorrectos. Por favor verifique sus datos de acceso.'

    context = {
        'error_message': error_message,
        'submitted_username': submitted_username,
        'next_url': next_url,
    }
    return render(request, 'organigrama/login.html', context)

def logout_view(request):
    """
    Cierra la sesión del usuario y redirige a la pantalla de login.
    """
    logout(request)
    return redirect('/login/?logged_out=1')

@login_required(login_url='login')
def organigrama_view(request):
    """
    Vista de Consulta del Organigrama Institucional (Solo Lectura).
    Accesible para todos los usuarios autenticados (dorquera y miriarte).
    """
    state_obj = OrganigramaState.get_current_state()
    context = {
        'state_json': json.dumps(state_obj.data),
        'version': state_obj.version,
        'updated_at': state_obj.updated_at,
        'user': request.user,
    }
    return render(request, 'organigrama/organigrama.html', context)

@login_required(login_url='login')
def gestion_view(request):
    """
    Panel de Administración y Gestión Completa (Sectores, Personal, Altas/Bajas).
    Restringido exclusivamente a usuarios con rol Administrador (is_staff / is_superuser).
    Si un usuario estándar intenta ingresar, se le deniega el acceso y se lo redirige al organigrama.
    """
    if not (request.user.is_staff or request.user.is_superuser):
        return redirect('/organigrama/?denied=1')

    state_obj = OrganigramaState.get_current_state()
    context = {
        'state_json': json.dumps(state_obj.data),
        'version': state_obj.version,
        'updated_at': state_obj.updated_at,
        'user': request.user,
    }
    return render(request, 'organigrama/index.html', context)

@require_http_methods(['GET', 'POST'])
@csrf_exempt
def api_state(request):
    """
    API REST de sincronización con la base de datos de Django.
    GET: Requiere usuario autenticado.
    POST: Requiere rol Administrador (is_staff / is_superuser).
    """
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'No autenticado. Inicie sesión para consultar los datos.'}, status=401)

    state_obj = OrganigramaState.get_current_state()

    if request.method == 'GET':
        return JsonResponse(state_obj.data, safe=False)

    if request.method == 'POST':
        if not (request.user.is_staff or request.user.is_superuser):
            return HttpResponseForbidden(
                json.dumps({'error': 'No posee permisos de administrador para modificar la nómina o sectores.'}),
                content_type='application/json'
            )

        try:
            payload = json.loads(request.body.decode('utf-8'))
        except (ValueError, UnicodeDecodeError) as e:
            return HttpResponseBadRequest(json.dumps({'error': f'JSON inválido: {str(e)}'}), content_type='application/json')

        if not isinstance(payload, dict) or 'sectores' not in payload or 'personal' not in payload:
            return HttpResponseBadRequest(
                json.dumps({'error': 'La estructura enviada debe contener las propiedades "sectores" y "personal"'}),
                content_type='application/json'
            )

        state_obj.data = payload
        state_obj.version += 1
        state_obj.save()

        return JsonResponse({
            'status': 'ok',
            'message': 'Estado guardado correctamente en la base de datos de Django',
            'version': state_obj.version,
            'updated_at': state_obj.updated_at.isoformat(),
            'sectores_count': len(payload.get('sectores', [])),
            'personal_count': len(payload.get('personal', []))
        })

@require_http_methods(['POST'])
@csrf_exempt
def api_reset_state(request):
    """
    Restaura los datos iniciales de fábrica en la base de datos.
    Exclusivo para administradores.
    """
    if not request.user.is_authenticated or not (request.user.is_staff or request.user.is_superuser):
        return HttpResponseForbidden(
            json.dumps({'error': 'Operación no autorizada.'}),
            content_type='application/json'
        )

    state_obj = OrganigramaState.get_current_state()
    from django.conf import settings
    json_path = settings.BASE_DIR / 'initial_data.json'
    if not json_path.exists():
        json_path = settings.BASE_DIR / 'data.json'

    if not json_path.exists():
        return JsonResponse({'status': 'error', 'message': 'No se encontró el archivo de datos base inicial'}, status=500)

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    state_obj.data = data
    state_obj.version += 1
    state_obj.save()

    return JsonResponse({
        'status': 'ok',
        'message': 'Estado restablecido a los datos de fábrica',
        'version': state_obj.version,
        'updated_at': state_obj.updated_at.isoformat()
    })

def health_check(request):
    """
    Health check endpoint para monitoreo en Coolify / Docker / Traefik.
    """
    try:
        state_count = OrganigramaState.objects.count()
        db_status = 'ok'
    except Exception as e:
        db_status = f'error: {str(e)}'

    return JsonResponse({
        'status': 'healthy' if db_status == 'ok' else 'degraded',
        'service': 'SNAF Organigrama Jujuy',
        'database': db_status,
        'states_in_db': state_count
    })
