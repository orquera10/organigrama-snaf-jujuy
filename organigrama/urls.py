"""
URLs de la aplicación organigrama.
"""
from django.urls import path
from . import views

urlpatterns = [
    # Autenticación y Control de Acceso
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # Vista de Consulta del Organigrama (Solo Lectura)
    path('', views.organigrama_view, name='organigrama_root'),
    path('organigrama/', views.organigrama_view, name='organigrama'),
    path('organigrama.html', views.organigrama_view, name='organigrama_html'),
    path('visor/', views.organigrama_view, name='visor'),
    path('visor.html', views.organigrama_view, name='visor_html'),

    # Panel de Administración y Gestión
    path('gestion/', views.gestion_view, name='gestion'),
    path('index.html', views.gestion_view, name='index_html'),
    path('admin-organigrama/', views.gestion_view, name='admin_organigrama'),

    # API REST de Sincronización
    path('api/state/', views.api_state, name='api_state'),
    path('api/reset/', views.api_reset_state, name='api_reset'),

    # Health Check para Coolify
    path('health/', views.health_check, name='health_check'),
    path('api/health/', views.health_check, name='api_health_check'),
]
