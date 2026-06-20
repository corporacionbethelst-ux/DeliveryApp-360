-- ============================================
-- DELIVERY360 - SCRIPT DE DIAGNÓSTICO SQL
-- ============================================
-- Ejecutar en psql o cliente PostgreSQL para verificar integridad de datos
-- ============================================

-- 1. VERIFICAR USUARIOS EXISTENTES CON ROLES
SELECT 
    id,
    email,
    first_name,
    last_name,
    role,
    is_active,
    created_at
FROM users
ORDER BY role, created_at DESC;

-- 2. VERIFICAR REPARTIDORES Y SU VINCULACIÓN CON USERS
SELECT 
    r.id AS rider_id,
    r.user_id,
    u.email AS user_email,
    u.first_name AS rider_first_name,
    u.last_name AS rider_last_name,
    r.status AS rider_status,
    r.is_online,
    r.vehicle_type,
    CASE 
        WHEN r.user_id IS NULL THEN '❌ SIN USER_ID'
        WHEN u.id IS NULL THEN '❌ USER_ID INVÁLIDO (FK rota)'
        ELSE '✅ VINCULADO CORRECTAMENTE'
    END AS integridad_relacion
FROM riders r
LEFT JOIN users u ON r.user_id = u.id
ORDER BY r.created_at DESC;

-- 3. VERIFICAR ÓRDENES CON DATOS DE CLIENTE
SELECT 
    id,
    external_id,
    customer_name,
    customer_phone,
    status,
    assigned_rider_id,
    ordered_at
FROM orders
ORDER BY ordered_at DESC
LIMIT 20;

-- 4. VERIFICAR ENTREGAS Y SUS RELACIONES
SELECT 
    d.id AS delivery_id,
    d.order_id,
    d.rider_id,
    d.status AS delivery_status,
    o.customer_name,
    o.external_id,
    r.user_id AS rider_user_id,
    u.first_name AS rider_first_name,
    u.last_name AS rider_last_name,
    CASE 
        WHEN d.order_id IS NULL THEN '❌ SIN ORDER_ID'
        WHEN o.id IS NULL THEN '❌ ORDER_ID INVÁLIDO (FK rota)'
        ELSE '✅ ORDER VINCULADO'
    END AS order_integrity,
    CASE 
        WHEN d.rider_id IS NULL THEN '❌ SIN RIDER_ID'
        WHEN r.id IS NULL THEN '❌ RIDER_ID INVÁLIDO (FK rota)'
        ELSE '✅ RIDER VINCULADO'
    END AS rider_integrity
FROM deliveries d
LEFT JOIN orders o ON d.order_id = o.id
LEFT JOIN riders r ON d.rider_id = r.id
LEFT JOIN users u ON r.user_id = u.id
ORDER BY d.created_at DESC
LIMIT 20;

-- 5. DETECTAR ENTREGAS HUÉRFANAS (SIN ORDER VÁLIDO)
SELECT 
    d.id AS delivery_id,
    d.order_id,
    '❌ ENTREGA HUÉRFANA - ORDER NO EXISTE' AS problema
FROM deliveries d
LEFT JOIN orders o ON d.order_id = o.id
WHERE o.id IS NULL;

-- 6. DETECTAR REPARTIDORES SIN USUARIO PADRE
SELECT 
    r.id AS rider_id,
    r.user_id,
    '❌ RIDER SIN USER - FK INVÁLIDA' AS problema
FROM riders r
LEFT JOIN users u ON r.user_id = u.id
WHERE u.id IS NULL;

-- 7. CONTAR INTEGRIDAD DE DATOS
SELECT 
    'USUARIOS TOTALES' AS metrica,
    COUNT(*) AS valor
FROM users
UNION ALL
SELECT 
    'REPARTIDORES TOTALES',
    COUNT(*)
FROM riders
UNION ALL
SELECT 
    'RIDERS CON USER VÁLIDO',
    COUNT(*)
FROM riders r
JOIN users u ON r.user_id = u.id
UNION ALL
SELECT 
    'ORDENES TOTALES',
    COUNT(*)
FROM orders
UNION ALL
SELECT 
    'ENTREGAS TOTALES',
    COUNT(*)
FROM deliveries
UNION ALL
SELECT 
    'ENTREGAS CON ORDER Y RIDER VÁLIDOS',
    COUNT(*)
FROM deliveries d
JOIN orders o ON d.order_id = o.id
JOIN riders r ON d.rider_id = r.id
JOIN users u ON r.user_id = u.id;

-- 8. VERIFICAR USUARIO super@delivery360.com
SELECT 
    id,
    email,
    first_name,
    last_name,
    role,
    is_active,
    CASE 
        WHEN email = 'super@delivery360.com' AND is_active = true THEN '✅ LISTO PARA LOGIN'
        WHEN email = 'super@delivery360.com' AND is_active = false THEN '⚠️ USUARIO INACTIVO'
        ELSE 'ℹ️ NO APLICA'
    END AS estado_login
FROM users
WHERE email = 'super@delivery360.com';

-- 9. CONSULTA COMPLETA PARA EL ENDPOINT /deliveries (SIMULACIÓN)
SELECT 
    d.id AS delivery_id,
    d.order_id,
    o.external_id,
    o.customer_name,
    d.rider_id,
    r.id AS rider_exists,
    u.first_name AS rider_first_name,
    u.last_name AS rider_last_name,
    d.status,
    d.created_at
FROM deliveries d
LEFT JOIN orders o ON d.order_id = o.id
LEFT JOIN riders r ON d.rider_id = r.id
LEFT JOIN users u ON r.user_id = u.id
ORDER BY d.created_at DESC
LIMIT 50;

-- ============================================
-- FIN DEL SCRIPT DE DIAGNÓSTICO
-- ============================================
