-- ============================================
-- DELIVERY360 - ESQUEMA DE BASE DE DATOS CORREGIDO
-- Basado estrictamente en la migración a617d286d3d0
-- ============================================

-- 0. EXTENSIÓN POSTGIS (Requerida para geolocalización)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. DEFINICIÓN DE ENUMS (Faltaban en tu script)
CREATE TYPE userrole AS ENUM ('SUPERADMIN', 'GERENTE', 'OPERADOR', 'REPARTIDOR', 'CLIENTE');
CREATE TYPE actiontype AS ENUM ('LOGIN', 'LOGOUT', 'CREATE', 'READ', 'UPDATE', 'DELETE', 'ASSIGN', 'REASSIGN', 'STATUS_CHANGE', 'PAYMENT', 'EXPORT', 'IMPORT', 'CONFIG_CHANGE', 'ACCESS_DENIED');
CREATE TYPE integrationtype AS ENUM ('ERP', 'POS', 'PAYMENT', 'MAPS', 'SMS', 'EMAIL');
CREATE TYPE integrationstatus AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');
CREATE TYPE vehicletype AS ENUM ('MOTO', 'BICICLETA', 'PATINETA', 'AUTO', 'FURGONETA');
CREATE TYPE riderstatus AS ENUM ('PENDIENTE', 'ACTIVO', 'INACTIVO', 'OCUPADO', 'SUSPENDIDO');
CREATE TYPE notificationtype AS ENUM ('ALERTA_OPERACIONAL', 'ASIGNACION_PEDIDO', 'ESTADO_ENTREGA', 'RECORDATORIO', 'LOGRO', 'SISTEMA', 'URGENTE');
CREATE TYPE notificationpriority AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'CRITICA');
CREATE TYPE orderstatus AS ENUM ('PENDIENTE', 'ASIGNADO', 'EN_RECOLECCION', 'RECOLECTADO', 'EN_RUTA', 'ENTREGADO', 'FALLIDO', 'CANCELADO');
CREATE TYPE orderpriority AS ENUM ('NORMAL', 'ALTA', 'URGENTE');
CREATE TYPE documenttype AS ENUM ('LICENCIA', 'DOCUMENTO_IDENTIDAD', 'REGISTRO_VEHICULO', 'SEGURO');
CREATE TYPE documentstatus AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');
CREATE TYPE shiftstatus AS ENUM ('PROGRAMADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO', 'INCOMPLETO');
CREATE TYPE deliverystatus AS ENUM ('PENDIENTE', 'INICIADA', 'EN_PICKUP', 'EN_ROUTE', 'EN_DESTINO', 'COMPLETADA', 'FALLIDA');
CREATE TYPE transactiontype AS ENUM ('PAGO_ENTREGA', 'BONO', 'DESCUENTO', 'AJUSTE', 'RETIRO');
CREATE TYPE paymentstatus AS ENUM ('PENDIENTE', 'PROCESADO', 'PAGADO', 'RECHAZADO');
CREATE TYPE metrictype AS ENUM ('ENTREGAS_TOTAL', 'TIEMPO_PROMEDIO', 'CALIFICACION', 'DISTANCIA_TOTAL', 'INGRESOS_TURNO');
CREATE TYPE routestatus AS ENUM ('PLANIFICADA', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA');
CREATE TYPE prooftype AS ENUM ('FOTO', 'FIRMA', 'OTP', 'NINGUNO');
CREATE TYPE payoutstatus AS ENUM ('PENDIENTE', 'PROCESADO', 'RECHAZADO', 'CANCELADO');
CREATE TYPE payoutmethod AS ENUM ('TRANSFERENCIA', 'EFECTIVO', 'BILLETERA_DIGITAL');

-- 2. TABLAS

-- USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role userrole DEFAULT 'CLIENTE',
    avatar_url VARCHAR(500),
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0, -- Corregido a INTEGER
    locked_until TIMESTAMP,
    reset_token VARCHAR(500),
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX ix_users_email ON users(email);
CREATE INDEX ix_users_id ON users(id);

-- RIDERS (Con balances numéricos y current_order_id)
CREATE TABLE riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    vehicle_type vehicletype,
    vehicle_plate VARCHAR(20),
    vehicle_model VARCHAR(100),
    operating_zone VARCHAR(100),
    cpf VARCHAR(14),
    cnh VARCHAR(20),
    status riderstatus DEFAULT 'PENDIENTE',
    is_online BOOLEAN DEFAULT FALSE,
    last_location GEOMETRY(POINT, 4326),
    last_lat FLOAT,
    last_lng FLOAT,
    last_location_at TIMESTAMP,
    level INTEGER DEFAULT 1,
    total_points INTEGER DEFAULT 0,
    badges JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    approved_at TIMESTAMP,
    current_order_id UUID, -- Vital para lógica de ocupado
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    wallet_balance NUMERIC(10, 2) DEFAULT 0.00, -- Financiero preciso
    pending_balance NUMERIC(10, 2) DEFAULT 0.00,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL
);
CREATE INDEX ix_riders_user_id ON riders(user_id);
CREATE INDEX ix_riders_id ON riders(id);
-- Índice espacial para búsquedas geográficas rápidas
CREATE INDEX idx_riders_last_location ON riders USING GIST (last_location);

-- ORDERS (Items como JSONB, montos como FLOAT según tu migración original, pero recomendado NUMERIC)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(100) UNIQUE,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255),
    pickup_address TEXT NOT NULL,
    pickup_name VARCHAR(255),
    pickup_phone VARCHAR(20),
    delivery_address TEXT NOT NULL,
    delivery_reference VARCHAR(255),
    delivery_instructions TEXT,
    pickup_latitude FLOAT,
    pickup_longitude FLOAT,
    delivery_latitude FLOAT,
    delivery_longitude FLOAT,
    items JSONB, -- Usar JSONB en Postgres
    subtotal FLOAT,
    delivery_fee FLOAT,
    total FLOAT,
    payment_method VARCHAR(50),
    payment_status VARCHAR(20),
    status orderstatus DEFAULT 'PENDIENTE',
    priority orderpriority DEFAULT 'NORMAL',
    assigned_rider_id UUID,
    ordered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP,
    picked_up_at TIMESTAMP,
    delivered_at TIMESTAMP,
    estimated_delivery_time TIMESTAMP,
    sla_deadline TIMESTAMP,
    failure_reason VARCHAR(255),
    failure_notes TEXT,
    cancelled_by VARCHAR(50),
    cancellation_reason TEXT,
    source VARCHAR(50),
    integration_id VARCHAR(100),
    webhook_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (assigned_rider_id) REFERENCES riders(id) ON DELETE SET NULL
);
CREATE INDEX ix_orders_assigned_rider_id ON orders(assigned_rider_id);
CREATE INDEX ix_orders_external_id ON orders(external_id);
CREATE INDEX ix_orders_id ON orders(id);

-- Actualizar Riders para apuntar a Orders (FK circular resuelta)
ALTER TABLE riders ADD CONSTRAINT fk_riders_current_order 
FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- AUDIT_LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    user_email VARCHAR(255),
    user_role VARCHAR(50),
    action_type actiontype NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    description TEXT,
    old_values JSONB,
    new_values JSONB,
    changes_summary VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    request_method VARCHAR(10),
    request_path VARCHAR(255),
    latitude FLOAT,
    longitude FLOAT,
    status_code INTEGER,
    success BOOLEAN,
    error_message TEXT,
    contains_personal_data BOOLEAN,
    data_subject_id INTEGER,
    retention_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_audit_user_date ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- DELIVERIES
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE, -- 1 a 1 estricto
    rider_id UUID NOT NULL,
    status deliverystatus DEFAULT 'PENDIENTE',
    started_at TIMESTAMP,
    arrived_pickup_at TIMESTAMP,
    left_pickup_at TIMESTAMP,
    arrived_delivery_at TIMESTAMP,
    completed_at TIMESTAMP,
    current_latitude FLOAT,
    current_longitude FLOAT,
    last_location_update TIMESTAMP,
    route_data JSONB,
    distance_total FLOAT,
    distance_pickup FLOAT,
    distance_delivery FLOAT,
    proof_type prooftype,
    proof_photo_url VARCHAR(500),
    proof_signature TEXT,
    proof_otp VARCHAR(10),
    proof_notes TEXT,
    customer_name_received VARCHAR(255),
    has_issues BOOLEAN DEFAULT FALSE,
    issue_type VARCHAR(50),
    issue_description TEXT,
    issue_resolved BOOLEAN,
    time_to_pickup INTEGER, -- Minutos
    time_at_pickup INTEGER,
    time_to_delivery INTEGER,
    total_time INTEGER,
    sla_expected_minutes INTEGER,
    sla_actual_minutes INTEGER,
    sla_compliant BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL
);
CREATE INDEX ix_deliveries_order_id ON deliveries(order_id);
CREATE INDEX ix_deliveries_rider_id ON deliveries(rider_id);

-- FINANCIALS (Usando NUMERIC para dinero)
CREATE TABLE financials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL,
    shift_id UUID,
    transaction_type transactiontype NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2),
    status paymentstatus DEFAULT 'PENDIENTE',
    description TEXT,
    reference_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (rider_id) REFERENCES riders(id),
    FOREIGN KEY (shift_id) REFERENCES shifts(id)
);

-- SHIFTS
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL,
    shift_date DATE NOT NULL, -- Usar DATE para el día, TIME para horas si es necesario, o TIMESTAMP
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    check_in_at TIMESTAMP,
    check_out_at TIMESTAMP,
    status shiftstatus DEFAULT 'PROGRAMADO',
    check_in_latitude FLOAT,
    check_in_longitude FLOAT,
    check_out_latitude FLOAT,
    check_out_longitude FLOAT,
    total_deliveries INTEGER DEFAULT 0,
    completed_deliveries INTEGER DEFAULT 0,
    total_earnings NUMERIC(10, 2) DEFAULT 0.00,
    notes VARCHAR(500),
    cancellation_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE
);

-- TABLAS ADICIONALES FALTANTES EN TU SCRIPT (Críticas)
CREATE TABLE rider_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL,
    type documenttype NOT NULL,
    status documentstatus NOT NULL,
    file_url TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE
);

CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status payoutstatus DEFAULT 'PENDIENTE',
    method payoutmethod,
    bank_account_last4 VARCHAR(10),
    reference_code VARCHAR(50),
    rejection_reason TEXT,
    requested_at TIMESTAMP,
    processed_at TIMESTAMP,
    FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE
);
CREATE INDEX ix_payouts_rider_id ON payouts(rider_id);

-- Routes, Alerts, Notifications, etc. seguirían aquí siguiendo el mismo patrón...