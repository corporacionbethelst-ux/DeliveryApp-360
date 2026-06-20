"""initial_schema_complete

Revision ID: a617d286d3d0
Revises: 
Create Date: 2026-05-05 15:23:37.986421

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import geoalchemy2
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision: str = 'a617d286d3d0'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ==========================================
    # 0. ACTIVAR EXTENSIÓN POSTGIS (CRÍTICO)
    # ==========================================
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')

    # ==========================================
    # TABLAS DE LA APLICACIÓN (DELIVERY360)
    # ==========================================

    # 1. USERS
    op.create_table('users',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('is_superuser', sa.Boolean(), nullable=True),
    sa.Column('first_name', sa.String(length=100), nullable=False),
    sa.Column('last_name', sa.String(length=100), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=True),
    sa.Column('role', sa.Enum('SUPERADMIN', 'GERENTE', 'OPERADOR', 'REPARTIDOR', 'CLIENTE', name='userrole'), nullable=True),
    sa.Column('avatar_url', sa.String(length=500), nullable=True),
    sa.Column('last_login', sa.DateTime(), nullable=True),
    sa.Column('failed_login_attempts', sa.String(), nullable=True),
    sa.Column('locked_until', sa.DateTime(), nullable=True),
    sa.Column('reset_token', sa.String(length=500), nullable=True),
    sa.Column('reset_token_expires', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    # 2. ZONES
    op.create_table('zones',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('code', sa.String(length=20), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('delivery_fee_base', sa.Float(), server_default='0', nullable=False),
    sa.Column('cost_per_km', sa.Float(), server_default='0', nullable=False),
    sa.Column('estimated_time_min', sa.Float(), server_default='30', nullable=False),
    sa.Column('is_priority', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('color_hex', sa.String(length=7), server_default='#6b7280', nullable=False),
    sa.Column('center_lat', sa.Float(), nullable=True),
    sa.Column('center_lng', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=False), server_default=sa.text('NOW()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_zones_id'), 'zones', ['id'], unique=False)
    op.create_index(op.f('ix_zones_code'), 'zones', ['code'], unique=True)
    op.create_index('ix_zones_active_priority', 'zones', ['is_active', 'is_priority'], unique=False)

    # 3. AUDIT_LOGS
    op.create_table('audit_logs',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('user_email', sa.String(length=255), nullable=True),
    sa.Column('user_role', sa.String(length=50), nullable=True),
    sa.Column('action_type', sa.Enum('LOGIN', 'LOGOUT', 'CREATE', 'READ', 'UPDATE', 'DELETE', 'ASSIGN', 'REASSIGN', 'STATUS_CHANGE', 'PAYMENT', 'EXPORT', 'IMPORT', 'CONFIG_CHANGE', 'ACCESS_DENIED', name='actiontype'), nullable=False),
    sa.Column('resource_type', sa.String(length=50), nullable=True),
    sa.Column('resource_id', sa.String(length=100), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('old_values', sa.JSON(), nullable=True),
    sa.Column('new_values', sa.JSON(), nullable=True),
    sa.Column('changes_summary', sa.String(length=500), nullable=True),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('user_agent', sa.String(length=500), nullable=True),
    sa.Column('request_method', sa.String(length=10), nullable=True),
    sa.Column('request_path', sa.String(length=255), nullable=True),
    sa.Column('latitude', sa.Float(), nullable=True),
    sa.Column('longitude', sa.Float(), nullable=True),
    sa.Column('status_code', sa.Integer(), nullable=True),
    sa.Column('success', sa.Boolean(), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('contains_personal_data', sa.Boolean(), nullable=True),
    sa.Column('data_subject_id', sa.Integer(), nullable=True),
    sa.Column('retention_until', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_audit_resource', 'audit_logs', ['resource_type', 'resource_id'], unique=False)
    op.create_index('idx_audit_user_date', 'audit_logs', ['user_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_audit_logs_action_type'), 'audit_logs', ['action_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_audit_logs_resource_id'), 'audit_logs', ['resource_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_resource_type'), 'audit_logs', ['resource_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)

    # 4. INTEGRATIONS
    op.create_table('integrations',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('integration_type', sa.Enum('ERP', 'POS', 'PAYMENT', 'MAPS', 'SMS', 'EMAIL', name='integrationtype'), nullable=False),
    sa.Column('provider', sa.String(length=50), nullable=True),
    sa.Column('api_url', sa.String(length=500), nullable=True),
    sa.Column('api_version', sa.String(length=20), nullable=True),
    sa.Column('auth_type', sa.String(length=20), nullable=True),
    sa.Column('credentials', sa.Text(), nullable=True),
    sa.Column('token_expires_at', sa.DateTime(), nullable=True),
    sa.Column('status', sa.Enum('ACTIVE', 'INACTIVE', 'ERROR', name='integrationstatus'), nullable=True),
    sa.Column('last_sync_at', sa.DateTime(), nullable=True),
    sa.Column('last_error_at', sa.DateTime(), nullable=True),
    sa.Column('last_error_message', sa.Text(), nullable=True),
    sa.Column('consecutive_failures', sa.Integer(), nullable=True),
    sa.Column('config', sa.Text(), nullable=True),
    sa.Column('webhook_url', sa.String(length=500), nullable=True),
    sa.Column('webhook_secret', sa.String(length=255), nullable=True),
    sa.Column('sync_enabled', sa.Boolean(), nullable=True),
    sa.Column('sync_frequency_minutes', sa.Integer(), nullable=True),
    sa.Column('sync_last_run', sa.DateTime(), nullable=True),
    sa.Column('sync_next_run', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_integrations_created_by'), 'integrations', ['created_by'], unique=False)
    op.create_index(op.f('ix_integrations_id'), 'integrations', ['id'], unique=False)

    # 5. RIDERS (Con PostGIS y Balances)
    op.create_table('riders',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('vehicle_type', sa.Enum('MOTO', 'BICICLETA', 'PATINETA', 'AUTO', 'FURGONETA', name='vehicletype'), nullable=True),
    sa.Column('vehicle_plate', sa.String(length=20), nullable=True),
    sa.Column('vehicle_model', sa.String(length=100), nullable=True),
    sa.Column('operating_zone', sa.String(length=100), nullable=True),
    sa.Column('zone_id', sa.UUID(), nullable=True),
    sa.Column('cpf', sa.String(length=14), nullable=True),
    sa.Column('cnh', sa.String(length=20), nullable=True),
    sa.Column('status', sa.Enum('PENDIENTE', 'ACTIVO', 'INACTIVO', 'OCUPADO', 'SUSPENDIDO', name='riderstatus'), nullable=True),
    sa.Column('is_online', sa.Boolean(), nullable=True),
    sa.Column('last_location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('last_lat', sa.Float(), nullable=True),
    sa.Column('last_lng', sa.Float(), nullable=True),
    sa.Column('last_location_at', sa.DateTime(), nullable=True),
    sa.Column('level', sa.Integer(), nullable=True),
    sa.Column('total_points', sa.Integer(), nullable=True),
    sa.Column('badges', sa.JSON(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('approved_at', sa.DateTime(), nullable=True),
    sa.Column('current_order_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.Column('wallet_balance', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('pending_balance', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('documents_metadata', sa.JSON(), nullable=True), 
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['zone_id'], ['zones.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_riders_id'), 'riders', ['id'], unique=False)
    op.create_index(op.f('ix_riders_user_id'), 'riders', ['user_id'], unique=True)
    op.create_index(op.f('ix_riders_zone_id'), 'riders', ['zone_id'], unique=False)

    # 5. AUDIT_ACTIONS
    op.create_table('audit_actions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('audit_log_id', sa.UUID(), nullable=True),
    sa.Column('field_name', sa.String(length=100), nullable=True),
    sa.Column('old_value', sa.Text(), nullable=True),
    sa.Column('new_value', sa.Text(), nullable=True),
    sa.Column('change_type', sa.String(length=20), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['audit_log_id'], ['audit_logs.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_actions_audit_log_id'), 'audit_actions', ['audit_log_id'], unique=False)
    op.create_index(op.f('ix_audit_actions_created_at'), 'audit_actions', ['created_at'], unique=False)
    op.create_index(op.f('ix_audit_actions_id'), 'audit_actions', ['id'], unique=False)

    # 6. NOTIFICATIONS
    op.create_table('notifications',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('rider_id', sa.UUID(), nullable=True),
    sa.Column('notification_type', sa.Enum('ALERTA_OPERACIONAL', 'ASIGNACION_PEDIDO', 'ESTADO_ENTREGA', 'RECORDATORIO', 'LOGRO', 'SISTEMA', 'URGENTE', name='notificationtype'), nullable=False),
    sa.Column('priority', sa.Enum('BAJA', 'NORMAL', 'ALTA', 'CRITICA', name='notificationpriority'), nullable=True),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('data', sa.JSON(), nullable=True),
    sa.Column('channels', sa.String(length=100), nullable=True),
    sa.Column('sent_channels', sa.String(length=100), nullable=True),
    sa.Column('is_read', sa.Boolean(), nullable=True),
    sa.Column('read_at', sa.DateTime(), nullable=True),
    sa.Column('is_sent', sa.Boolean(), nullable=True),
    sa.Column('sent_at', sa.DateTime(), nullable=True),
    sa.Column('failed_channels', sa.String(length=100), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('action_url', sa.String(length=500), nullable=True),
    sa.Column('action_type', sa.String(length=50), nullable=True),
    sa.Column('related_type', sa.String(length=50), nullable=True),
    sa.Column('related_id', sa.String(length=100), nullable=True),
    sa.Column('scheduled_for', sa.DateTime(), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['rider_id'], ['riders.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_created_at'), 'notifications', ['created_at'], unique=False)
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'], unique=False)
    op.create_index(op.f('ix_notifications_rider_id'), 'notifications', ['rider_id'], unique=False)
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
 
    # 7. ORDERS
    op.create_table('orders',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('external_id', sa.String(length=100), nullable=True),
    sa.Column('customer_name', sa.String(length=255), nullable=False),
    sa.Column('customer_phone', sa.String(length=20), nullable=False),
    sa.Column('customer_email', sa.String(length=255), nullable=True),
    sa.Column('pickup_address', sa.Text(), nullable=False),
    sa.Column('pickup_name', sa.String(length=255), nullable=True),
    sa.Column('pickup_phone', sa.String(length=20), nullable=True),
    sa.Column('delivery_address', sa.Text(), nullable=False),
    sa.Column('delivery_reference', sa.String(length=255), nullable=True),
    sa.Column('delivery_instructions', sa.Text(), nullable=True),
    sa.Column('pickup_latitude', sa.Float(), nullable=True),
    sa.Column('pickup_longitude', sa.Float(), nullable=True),
    sa.Column('delivery_latitude', sa.Float(), nullable=True),
    sa.Column('delivery_longitude', sa.Float(), nullable=True),
    sa.Column('items', sa.JSON(), nullable=True),
    sa.Column('subtotal', sa.Float(), nullable=True),
    sa.Column('delivery_fee', sa.Float(), nullable=True),
    sa.Column('total', sa.Float(), nullable=True),
    sa.Column('payment_method', sa.String(length=50), nullable=True),
    sa.Column('payment_status', sa.String(length=20), nullable=True),
    sa.Column('status', sa.Enum('PENDIENTE', 'ASIGNADO', 'EN_RECOLECCION', 'RECOLECTADO', 'EN_RUTA', 'ENTREGADO', 'FALLIDO', 'CANCELADO', name='orderstatus'), nullable=True),
    sa.Column('priority', sa.Enum('NORMAL', 'ALTA', 'URGENTE', name='orderpriority'), nullable=True),
    sa.Column('assigned_rider_id', sa.UUID(), nullable=True),
    sa.Column('ordered_at', sa.DateTime(), nullable=False),
    sa.Column('accepted_at', sa.DateTime(), nullable=True),
    sa.Column('picked_up_at', sa.DateTime(), nullable=True),
    sa.Column('delivered_at', sa.DateTime(), nullable=True),
    sa.Column('estimated_delivery_time', sa.DateTime(), nullable=True),
    sa.Column('sla_deadline', sa.DateTime(), nullable=True),
    sa.Column('failure_reason', sa.String(length=255), nullable=True),
    sa.Column('failure_notes', sa.Text(), nullable=True),
    sa.Column('cancelled_by', sa.String(length=50), nullable=True),
    sa.Column('cancellation_reason', sa.Text(), nullable=True),
    sa.Column('source', sa.String(length=50), nullable=True),
    sa.Column('integration_id', sa.String(length=100), nullable=True),
    sa.Column('webhook_sent', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['assigned_rider_id'], ['riders.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    
    # Índices para optimizar consultas
    op.create_index(op.f('ix_orders_assigned_rider_id'), 'orders', ['assigned_rider_id'], unique=False)
    op.create_index(op.f('ix_orders_external_id'), 'orders', ['external_id'], unique=True)
    op.create_index(op.f('ix_orders_id'), 'orders', ['id'], unique=False)

    # 🚨 CRÍTICO: Agregar esta línea que faltaba para vincular riders.current_order_id -> orders.id
    op.create_foreign_key(
        'fk_riders_current_order', 
        'riders', 
        'orders', 
        ['current_order_id'], 
        ['id'], 
        ondelete='SET NULL'
    )

    # 8. RIDER_DOCUMENTS
    op.create_table('rider_documents',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('rider_id', sa.UUID(), nullable=False),
    sa.Column('type', sa.Enum('LICENCIA', 'DOCUMENTO_IDENTIDAD', 'REGISTRO_VEHICULO', 'SEGURO', name='documenttype'), nullable=False),
    sa.Column('status', sa.Enum('PENDIENTE', 'APROBADO', 'RECHAZADO', name='documentstatus'), nullable=False),
    sa.Column('file_url', sa.Text(), nullable=True),
    sa.Column('rejection_reason', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=True),
    sa.ForeignKeyConstraint(['rider_id'], ['riders.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rider_documents_id'), 'rider_documents', ['id'], unique=False)
    op.create_index(op.f('ix_rider_documents_rider_id'), 'rider_documents', ['rider_id'], unique=False)

    # 9. SHIFTS
    op.create_table('shifts',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('rider_id', sa.UUID(), nullable=False),
    sa.Column('shift_date', sa.DateTime(), nullable=False),
    sa.Column('start_time', sa.Time(), nullable=False),
    sa.Column('end_time', sa.Time(), nullable=False),
    sa.Column('check_in_at', sa.DateTime(), nullable=True),
    sa.Column('check_out_at', sa.DateTime(), nullable=True),
    sa.Column('status', sa.Enum('PROGRAMADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO', 'INCOMPLETO', name='shiftstatus'), nullable=True),
    sa.Column('check_in_latitude', sa.Float(), nullable=True),
    sa.Column('check_in_longitude', sa.Float(), nullable=True),
    sa.Column('check_out_latitude', sa.Float(), nullable=True),
    sa.Column('check_out_longitude', sa.Float(), nullable=True),
    sa.Column('total_deliveries', sa.Integer(), nullable=True),
    sa.Column('completed_deliveries', sa.Integer(), nullable=True),
    sa.Column('total_earnings', sa.Float(), nullable=True),
    sa.Column('notes', sa.String(length=500), nullable=True),
    sa.Column('cancellation_reason', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['rider_id'], ['riders.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shifts_id'), 'shifts', ['id'], unique=False)
    op.create_index(op.f('ix_shifts_rider_id'), 'shifts', ['rider_id'], unique=False)
    op.create_index(op.f('ix_shifts_shift_date'), 'shifts', ['shift_date'], unique=False)

    # 10. CHECK_IN_OUT
    op.create_table('check_in_out',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('rider_id', sa.UUID(), nullable=False),
    sa.Column('shift_id', sa.UUID(), nullable=True),
    sa.Column('check_type', sa.String(length=10), nullable=False),
    sa.Column('timestamp', sa.DateTime(), nullable=False),
    sa.Column('latitude', sa.Float(), nullable=True),
    sa.Column('longitude', sa.Float(), nullable=True),
    sa.Column('device_id', sa.String(length=255), nullable=True),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('notes', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['rider_id'], ['riders.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_check_in_out_id'), 'check_in_out', ['id'], unique=False)
    op.create_index(op.f('ix_check_in_out_rider_id'), 'check_in_out', ['rider_id'], unique=False)
    op.create_index(op.f('ix_check_in_out_shift_id'), 'check_in_out', ['shift_id'], unique=False)

    # 11. DELIVERIES
    op.create_table('deliveries',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=False),
    sa.Column('rider_id', sa.UUID(), nullable=False),
    sa.Column('status', sa.Enum('PENDIENTE', 'INICIADA', 'EN_PICKUP', 'EN_ROUTE', 'EN_DESTINO', 'COMPLETADA', 'FALLIDA', name='deliverystatus'), nullable=True),
    sa.Column('started_at', sa.DateTime(), nullable=True),
    sa.Column('arrived_pickup_at', sa.DateTime(), nullable=True),
    sa.Column('left_pickup_at', sa.DateTime(), nullable=True),
    sa.Column('arrived_delivery_at', sa.DateTime(), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.Column('current_latitude', sa.Float(), nullable=True),
    sa.Column('current_longitude', sa.Float(), nullable=True),
    sa.Column('last_location_update', sa.DateTime(), nullable=True),
    sa.Column('route_data', sa.JSON(), nullable=True),
    sa.Column('distance_total', sa.Float(), nullable=True),
    sa.Column('distance_pickup', sa.Float(), nullable=True),
    sa.Column('distance_delivery', sa.Float(), nullable=True),
    sa.Column('proof_type', sa.Enum('FOTO', 'FIRMA', 'OTP', 'NINGUNO', name='prooftype'), nullable=True),
    sa.Column('proof_photo_url', sa.String(length=500), nullable=True),
    sa.Column('proof_signature', sa.Text(), nullable=True),
    sa.Column('proof_otp', sa.String(length=10), nullable=True),
    sa.Column('proof_notes', sa.Text(), nullable=True),
    sa.Column('customer_name_received', sa.String(length=255), nullable=True),
    sa.Column('has_issues', sa.Boolean(), nullable=True),
    sa.Column('issue_type', sa.String(length=50), nullable=True),
    sa.Column('issue_description', sa.Text(), nullable=True),
    sa.Column('issue_resolved', sa.Boolean(), nullable=True),
    sa.Column('time_to_pickup', sa.Integer(), nullable=True),
    sa.Column('time_at_pickup', sa.Integer(), nullable=True),
    sa.Column('time_to_delivery', sa.Integer(), nullable=True),
    sa.Column('total_time', sa.Integer(), nullable=True),
    sa.Column('sla_expected_minutes', sa.Integer(), nullable=True),
    sa.Column('sla_actual_minutes', sa.Integer(), nullable=True),
    sa.Column('sla_compliant', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['rider_id'], ['riders.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_deliveries_id'), 'deliveries', ['id'], unique=False)
    op.create_index(op.f('ix_deliveries_order_id'), 'deliveries', ['order_id'], unique=True)
    op.create_index(op.f('ix_deliveries_rider_id'), 'deliveries', ['rider_id'], unique=False)

    # 12. FINANCIALS
    op.create_table('financials',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('rider_id', sa.UUID(), nullable=False),
    sa.Column('shift_id', sa.UUID(), nullable=True),
    sa.Column('transaction_type', sa.Enum('PAGO_ENTREGA', 'BONO', 'DESCUENTO', 'AJUSTE', 'RETIRO', name='transactiontype'), nullable=False),
    sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('balance_before', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('balance_after', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('status', sa.Enum('PENDIENTE', 'PROCESADO', 'PAGADO', 'RECHAZADO', name='paymentstatus'), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('reference_id', sa.String(length=100), nullable=True),
    sa.Column('source_type', sa.String(length=50), nullable=True),
    sa.Column('source_id', sa.String(length=100), nullable=True),
    sa.Column('idempotency_key', sa.String(length=100), nullable=True),
    sa.Column('created_by_user_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['rider_id'], ['riders.id'], ),
    sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_financials_created_by_user_id'), 'financials', ['created_by_user_id'], unique=False)
    op.create_index(op.f('ix_financials_id'), 'financials', ['id'], unique=False)
    op.create_index(op.f('ix_financials_idempotency_key'), 'financials', ['idempotency_key'], unique=True)
    op.create_index(op.f('ix_financials_rider_id'), 'financials', ['rider_id'], unique=False)
    op.create_index(op.f('ix_financials_source_id'), 'financials', ['source_id'], unique=False)
    op.create_index(op.f('ix_financials_source_type'), 'financials', ['source_type'], unique=False)
    op.create_index(op.f('ix_financials_shift_id'), 'financials', ['shift_id'], unique=False)

    # 13. PRODUCTIVITY_RECORDS
    op.create_table('productivity_records',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('rider_id', sa.UUID(), nullable=False),
    sa.Column('shift_id', sa.UUID(), nullable=True),
    sa.Column('metric_type', sa.Enum('ENTREGAS_TOTAL', 'TIEMPO_PROMEDIO', 'CALIFICACION', 'DISTANCIA_TOTAL', 'INGRESOS_TURNO', name='metrictype'), nullable=False),
    sa.Column('value', sa.Float(), nullable=False),
    sa.Column('unit', sa.String(length=50), nullable=True),
    sa.Column('date', sa.DateTime(), nullable=False),
    sa.Column('notes', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['rider_id'], ['riders.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_productivity_records_id'), 'productivity_records', ['id'], unique=False)
    op.create_index(op.f('ix_productivity_records_rider_id'), 'productivity_records', ['rider_id'], unique=False)
    op.create_index(op.f('ix_productivity_records_shift_id'), 'productivity_records', ['shift_id'], unique=False)

    # 14. ALERTS
    op.create_table('alerts',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('alert_type', sa.String(length=50), nullable=False),
    sa.Column('severity', sa.String(length=20), nullable=True),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('order_id', sa.UUID(), nullable=True),
    sa.Column('delivery_id', sa.UUID(), nullable=True),
    sa.Column('rider_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.Column('acknowledged_by', sa.UUID(), nullable=True),
    sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
    sa.Column('resolved_by', sa.UUID(), nullable=True),
    sa.Column('resolved_at', sa.DateTime(), nullable=True),
    sa.Column('resolution_notes', sa.Text(), nullable=True),
    sa.Column('auto_resolve_at', sa.DateTime(), nullable=True),
    sa.Column('auto_resolved', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['acknowledged_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['delivery_id'], ['deliveries.id'], ),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['rider_id'], ['riders.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alerts_created_at'), 'alerts', ['created_at'], unique=False)
    op.create_index(op.f('ix_alerts_id'), 'alerts', ['id'], unique=False)

    # 15. ROUTES
    op.create_table('routes',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('delivery_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.Enum('PLANIFICADA', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA', name='routestatus'), nullable=True),
    sa.Column('planned_route', sa.JSON(), nullable=True),
    sa.Column('actual_route', sa.JSON(), nullable=True),
    sa.Column('pickup_latitude', sa.Float(), nullable=True),
    sa.Column('pickup_longitude', sa.Float(), nullable=True),
    sa.Column('delivery_latitude', sa.Float(), nullable=True),
    sa.Column('delivery_longitude', sa.Float(), nullable=True),
    sa.Column('planned_distance_km', sa.Float(), nullable=True),
    sa.Column('actual_distance_km', sa.Float(), nullable=True),
    sa.Column('planned_duration_minutes', sa.Integer(), nullable=True),
    sa.Column('actual_duration_minutes', sa.Integer(), nullable=True),
    sa.Column('has_deviation', sa.Boolean(), nullable=True),
    sa.Column('deviation_distance_km', sa.Float(), nullable=True),
    sa.Column('deviation_time_minutes', sa.Integer(), nullable=True),
    sa.Column('deviation_reason', sa.String(length=255), nullable=True),
    sa.Column('traffic_level', sa.String(length=20), nullable=True),
    sa.Column('weather_condition', sa.String(length=50), nullable=True),
    sa.Column('efficiency_score', sa.Float(), nullable=True),
    sa.Column('started_at', sa.DateTime(), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['delivery_id'], ['deliveries.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_routes_delivery_id'), 'routes', ['delivery_id'], unique=True)
    op.create_index(op.f('ix_routes_id'), 'routes', ['id'], unique=False)

    # 16. ROUTE_DEVIATIONS
    op.create_table('route_deviations',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('route_id', sa.UUID(), nullable=True),
    sa.Column('deviation_type', sa.String(length=50), nullable=True),
    sa.Column('severity', sa.String(length=20), nullable=True),
    sa.Column('latitude', sa.Float(), nullable=True),
    sa.Column('longitude', sa.Float(), nullable=True),
    sa.Column('detected_at', sa.DateTime(), nullable=False),
    sa.Column('resolved_at', sa.DateTime(), nullable=True),
    sa.Column('expected_location', sa.JSON(), nullable=True),
    sa.Column('actual_location', sa.JSON(), nullable=True),
    sa.Column('distance_from_route_km', sa.Float(), nullable=True),
    sa.Column('time_lost_minutes', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.Column('resolution_notes', sa.Text(), nullable=True),
    sa.Column('resolved_by', sa.UUID(), nullable=True),
    sa.Column('alert_sent', sa.Boolean(), nullable=True),
    sa.Column('alert_channels', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['route_id'], ['routes.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_route_deviations_id'), 'route_deviations', ['id'], unique=False)
    op.create_index(op.f('ix_route_deviations_route_id'), 'route_deviations', ['route_id'], unique=False)

    # 17. ROUTE_POINTS
    op.create_table('route_points',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('route_id', sa.UUID(), nullable=True),
    sa.Column('latitude', sa.Float(), nullable=False),
    sa.Column('longitude', sa.Float(), nullable=False),
    sa.Column('altitude', sa.Float(), nullable=True),
    sa.Column('accuracy', sa.Float(), nullable=True),
    sa.Column('speed', sa.Float(), nullable=True),
    sa.Column('heading', sa.Float(), nullable=True),
    sa.Column('timestamp', sa.DateTime(), nullable=False),
    sa.Column('battery_level', sa.Integer(), nullable=True),
    sa.Column('is_charging', sa.Boolean(), nullable=True),
    sa.Column('network_type', sa.String(length=20), nullable=True),
    sa.Column('source', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['route_id'], ['routes.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_route_points_id'), 'route_points', ['id'], unique=False)
    op.create_index(op.f('ix_route_points_route_id'), 'route_points', ['route_id'], unique=False)
    op.create_index(op.f('ix_route_points_timestamp'), 'route_points', ['timestamp'], unique=False)

    # 18. PAYOUTS
    op.create_table('payouts',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('rider_id', sa.UUID(), nullable=False),
    sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('status', sa.Enum('PENDIENTE', 'PROCESADO', 'RECHAZADO', 'CANCELADO', name='payoutstatus', create_type=False), nullable=True),
    sa.Column('method', sa.Enum('TRANSFERENCIA', 'EFECTIVO', 'BILLETERA_DIGITAL', name='payoutmethod', create_type=False), nullable=True),
    sa.Column('bank_account_last4', sa.String(length=10), nullable=True),
    sa.Column('reference_code', sa.String(length=50), nullable=True),
    sa.Column('rejection_reason', sa.Text(), nullable=True),
    sa.Column('idempotency_key', sa.String(length=100), nullable=True),
    sa.Column('balance_before', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('balance_after', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('requested_by_user_id', sa.UUID(), nullable=True),
    sa.Column('processed_by_user_id', sa.UUID(), nullable=True),
    sa.Column('requested_at', sa.DateTime(), nullable=True),
    sa.Column('processed_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['processed_by_user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['requested_by_user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['rider_id'], ['riders.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payouts_id'), 'payouts', ['id'], unique=False)
    op.create_index(op.f('ix_payouts_idempotency_key'), 'payouts', ['idempotency_key'], unique=True)
    op.create_index(op.f('ix_payouts_processed_by_user_id'), 'payouts', ['processed_by_user_id'], unique=False)
    op.create_index(op.f('ix_payouts_requested_by_user_id'), 'payouts', ['requested_by_user_id'], unique=False)
    op.create_index(op.f('ix_payouts_rider_id'), 'payouts', ['rider_id'], unique=False)

    # 18.1 PAYOUT STATUS HISTORY
    op.create_table('payout_status_history',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('payout_id', sa.UUID(), nullable=False),
    sa.Column('old_status', sa.String(length=30), nullable=True),
    sa.Column('new_status', sa.String(length=30), nullable=False),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('changed_by_user_id', sa.UUID(), nullable=True),
    sa.Column('balance_before', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('balance_after', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['changed_by_user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['payout_id'], ['payouts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payout_status_history_changed_by_user_id'), 'payout_status_history', ['changed_by_user_id'], unique=False)
    op.create_index(op.f('ix_payout_status_history_created_at'), 'payout_status_history', ['created_at'], unique=False)
    op.create_index(op.f('ix_payout_status_history_payout_id'), 'payout_status_history', ['payout_id'], unique=False)
    op.create_index('idx_payout_status_history_payout_date', 'payout_status_history', ['payout_id', 'created_at'], unique=False)

    # ==========================================
    # 19. VEHICLES (NUEVA TABLA AGREGADA)
    # ==========================================
    op.create_table('vehicles',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    # Enums nativos de SQL pasando los valores string explícitamente
    sa.Column('type', sa.Enum('MOTO', 'AUTO', 'FURGONETA', 'BICICLETA', name='vehicletype', create_type=False), nullable=False),
    sa.Column('status', sa.Enum('ACTIVO', 'MANTENIMIENTO', 'BAJA', name='vehiclestatus', create_type=False), nullable=False, server_default='ACTIVO'),
    
    sa.Column('plate', sa.String(length=20), nullable=False),
    sa.Column('model', sa.String(length=100), nullable=False),
    sa.Column('color', sa.String(length=50), nullable=False),
    sa.Column('year', sa.Integer(), nullable=False),
    
    sa.Column('insurance_expiry', sa.Date(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    
    # FK hacia users.id (dueño del vehículo)
    sa.Column('rider_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    
    sa.Column('created_at', sa.DateTime(timezone=False), server_default=sa.text('NOW()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True),
    
    sa.PrimaryKeyConstraint('id')
    )
    # Índices para optimización
    op.create_index(op.f('ix_vehicles_id'), 'vehicles', ['id'], unique=False)
    op.create_index(op.f('ix_vehicles_plate'), 'vehicles', ['plate'], unique=True)
    op.create_index(op.f('ix_vehicles_status'), 'vehicles', ['status'], unique=False)
    op.create_index(op.f('ix_vehicles_rider_id'), 'vehicles', ['rider_id'], unique=False)


def downgrade() -> None:
    # ==========================================
    # ELIMINAR TABLAS EN ORDEN INVERSO
    # ==========================================
    
    # 19. VEHICLES (NUEVO)
    op.drop_index(op.f('ix_vehicles_rider_id'), table_name='vehicles')
    op.drop_index(op.f('ix_vehicles_status'), table_name='vehicles')
    op.drop_index(op.f('ix_vehicles_plate'), table_name='vehicles')
    op.drop_index(op.f('ix_vehicles_id'), table_name='vehicles')
    op.drop_table('vehicles')

    # 18.1 PAYOUT STATUS HISTORY
    op.drop_index('idx_payout_status_history_payout_date', table_name='payout_status_history')
    op.drop_index(op.f('ix_payout_status_history_payout_id'), table_name='payout_status_history')
    op.drop_index(op.f('ix_payout_status_history_created_at'), table_name='payout_status_history')
    op.drop_index(op.f('ix_payout_status_history_changed_by_user_id'), table_name='payout_status_history')
    op.drop_table('payout_status_history')

    # 18. PAYOUTS
    op.drop_index(op.f('ix_payouts_rider_id'), table_name='payouts')
    op.drop_index(op.f('ix_payouts_requested_by_user_id'), table_name='payouts')
    op.drop_index(op.f('ix_payouts_processed_by_user_id'), table_name='payouts')
    op.drop_index(op.f('ix_payouts_idempotency_key'), table_name='payouts')
    op.drop_index(op.f('ix_payouts_id'), table_name='payouts')
    op.drop_table('payouts')

    # 17. ROUTE_POINTS
    op.drop_index(op.f('ix_route_points_timestamp'), table_name='route_points')
    op.drop_index(op.f('ix_route_points_route_id'), table_name='route_points')
    op.drop_index(op.f('ix_route_points_id'), table_name='route_points')
    op.drop_table('route_points')

    # 16. ROUTE_DEVIATIONS
    op.drop_index(op.f('ix_route_deviations_route_id'), table_name='route_deviations')
    op.drop_index(op.f('ix_route_deviations_id'), table_name='route_deviations')
    op.drop_table('route_deviations')

    # 15. ROUTES
    op.drop_index(op.f('ix_routes_delivery_id'), table_name='routes')
    op.drop_index(op.f('ix_routes_id'), table_name='routes')
    op.drop_table('routes')

    # 14. ALERTS
    op.drop_index(op.f('ix_alerts_created_at'), table_name='alerts')
    op.drop_index(op.f('ix_alerts_id'), table_name='alerts')
    op.drop_table('alerts')

    # 13. PRODUCTIVITY_RECORDS
    op.drop_index(op.f('ix_productivity_records_shift_id'), table_name='productivity_records')
    op.drop_index(op.f('ix_productivity_records_rider_id'), table_name='productivity_records')
    op.drop_index(op.f('ix_productivity_records_id'), table_name='productivity_records')
    op.drop_table('productivity_records')

    # 12. FINANCIALS
    op.drop_index(op.f('ix_financials_shift_id'), table_name='financials')
    op.drop_index(op.f('ix_financials_source_type'), table_name='financials')
    op.drop_index(op.f('ix_financials_source_id'), table_name='financials')
    op.drop_index(op.f('ix_financials_rider_id'), table_name='financials')
    op.drop_index(op.f('ix_financials_idempotency_key'), table_name='financials')
    op.drop_index(op.f('ix_financials_id'), table_name='financials')
    op.drop_index(op.f('ix_financials_created_by_user_id'), table_name='financials')
    op.drop_table('financials')

    # 11. DELIVERIES
    op.drop_index(op.f('ix_deliveries_order_id'), table_name='deliveries')
    op.drop_index(op.f('ix_deliveries_rider_id'), table_name='deliveries')
    op.drop_index(op.f('ix_deliveries_id'), table_name='deliveries')
    op.drop_table('deliveries')

    # 10. CHECK_IN_OUT
    op.drop_index(op.f('ix_check_in_out_shift_id'), table_name='check_in_out')
    op.drop_index(op.f('ix_check_in_out_rider_id'), table_name='check_in_out')
    op.drop_index(op.f('ix_check_in_out_id'), table_name='check_in_out')
    op.drop_table('check_in_out')

    # 9. SHIFTS
    op.drop_index(op.f('ix_shifts_shift_date'), table_name='shifts')
    op.drop_index(op.f('ix_shifts_rider_id'), table_name='shifts')
    op.drop_index(op.f('ix_shifts_id'), table_name='shifts')
    op.drop_table('shifts')

    # 8. RIDER_DOCUMENTS
    op.drop_index(op.f('ix_rider_documents_rider_id'), table_name='rider_documents')
    op.drop_index(op.f('ix_rider_documents_id'), table_name='rider_documents')
    op.drop_table('rider_documents')

    # 7. ORDERS
    # Primero eliminar la FK adicional creada manualmente
    op.drop_constraint('fk_riders_current_order', 'riders', type_='foreignkey')
    
    op.drop_index(op.f('ix_orders_external_id'), table_name='orders')
    op.drop_index(op.f('ix_orders_assigned_rider_id'), table_name='orders')
    op.drop_index(op.f('ix_orders_id'), table_name='orders')
    op.drop_table('orders')

    # 6. NOTIFICATIONS
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_rider_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_created_at'), table_name='notifications')
    op.drop_table('notifications')

    # 5. AUDIT_ACTIONS
    op.drop_index(op.f('ix_audit_actions_created_at'), table_name='audit_actions')
    op.drop_index(op.f('ix_audit_actions_audit_log_id'), table_name='audit_actions')
    op.drop_index(op.f('ix_audit_actions_id'), table_name='audit_actions')
    op.drop_table('audit_actions')

    # 5. RIDERS
    op.drop_index(op.f('ix_riders_zone_id'), table_name='riders')
    op.drop_index(op.f('ix_riders_user_id'), table_name='riders')
    op.drop_index(op.f('ix_riders_id'), table_name='riders')
    op.drop_table('riders')

    # 4. INTEGRATIONS
    op.drop_index(op.f('ix_integrations_created_by'), table_name='integrations')
    op.drop_index(op.f('ix_integrations_id'), table_name='integrations')
    op.drop_table('integrations')

    # 2. ZONES
    op.drop_index('ix_zones_active_priority', table_name='zones')
    op.drop_index(op.f('ix_zones_code'), table_name='zones')
    op.drop_index(op.f('ix_zones_id'), table_name='zones')
    op.drop_table('zones')

    # 3. AUDIT_LOGS
    op.drop_index('idx_audit_user_date', table_name='audit_logs')
    op.drop_index('idx_audit_resource', table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action_type'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_resource_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_resource_type'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_table('audit_logs')

    # 1. USERS
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')

    op.execute('DROP EXTENSION IF EXISTS postgis')