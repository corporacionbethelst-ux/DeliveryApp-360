# Comandos SQL para auditar datos del módulo Rider con Docker Compose

Esta guía reúne comandos SQL útiles para verificar por qué algunos valores del módulo Rider pueden aparecer vacíos o desactualizados en el frontend.

El proyecto usa el servicio `db` de Docker Compose con PostgreSQL/PostGIS, usuario `admin` y base `delivery360`.

## 0. Acceso a PostgreSQL

### Abrir consola interactiva

```bash
docker compose exec db psql -U admin -d delivery360
```

### Ejecutar una consulta directa

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "SELECT now();"
```

## 1. Conteo general de tablas importantes

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT 'users' AS table_name, COUNT(*) FROM users
UNION ALL SELECT 'riders', COUNT(*) FROM riders
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'deliveries', COUNT(*) FROM deliveries
UNION ALL SELECT 'financials', COUNT(*) FROM financials
UNION ALL SELECT 'payouts', COUNT(*) FROM payouts
UNION ALL SELECT 'payout_status_history', COUNT(*) FROM payout_status_history
UNION ALL SELECT 'shifts', COUNT(*) FROM shifts
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'alerts', COUNT(*) FROM alerts;
"
```

## 2. Listar riders con su usuario

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  r.id AS rider_id,
  r.user_id,
  u.email,
  u.first_name,
  u.last_name,
  u.role,
  u.is_active,
  r.status AS rider_status,
  r.is_online,
  r.vehicle_type,
  r.vehicle_plate,
  r.operating_zone,
  r.zone_id,
  r.current_order_id,
  r.last_lat,
  r.last_lng,
  r.last_location_at,
  r.created_at,
  r.updated_at
FROM riders r
LEFT JOIN users u ON u.id = r.user_id
ORDER BY r.created_at DESC;
"
```

## 3. Buscar un rider por email

Cambia `rider@delivery360.com` por el correo real usado en el login.

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  r.id AS rider_id,
  u.id AS user_id,
  u.email,
  u.role,
  u.is_active,
  r.status,
  r.is_online,
  r.current_order_id,
  r.created_at,
  r.updated_at
FROM users u
LEFT JOIN riders r ON r.user_id = u.id
WHERE lower(u.email) = lower('rider@delivery360.com');
"
```

## 4. Resumen completo de un rider

Reemplaza `PEGA_AQUI_EL_RIDER_ID` por el UUID del rider.

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  r.id AS rider_id,
  u.email,
  u.first_name,
  u.last_name,
  u.role,
  r.status,
  r.is_online,
  r.vehicle_type,
  r.vehicle_plate,
  r.operating_zone,
  r.zone_id,
  r.current_order_id,
  r.level,
  r.total_points,
  r.last_lat,
  r.last_lng,
  r.last_location_at,
  r.approved_at,
  r.created_at,
  r.updated_at
FROM riders r
JOIN users u ON u.id = r.user_id
WHERE r.id = 'PEGA_AQUI_EL_RIDER_ID';
"
```

## 5. Pedidos asignados al rider

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  o.id,
  o.external_id,
  o.customer_name,
  o.status,
  o.priority,
  o.payment_status,
  o.total,
  o.delivery_fee,
  o.assigned_rider_id,
  o.pickup_address,
  o.delivery_address,
  o.ordered_at,
  o.accepted_at,
  o.picked_up_at,
  o.delivered_at,
  o.created_at,
  o.updated_at
FROM orders o
WHERE o.assigned_rider_id = 'PEGA_AQUI_EL_RIDER_ID'
ORDER BY COALESCE(o.updated_at, o.created_at, o.ordered_at) DESC;
"
```

## 6. Entregas del rider

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  d.id AS delivery_id,
  d.order_id,
  d.rider_id,
  d.status AS delivery_status,
  d.started_at,
  d.arrived_pickup_at,
  d.left_pickup_at,
  d.arrived_delivery_at,
  d.completed_at,
  d.current_latitude,
  d.current_longitude,
  d.last_location_update,
  d.distance_total,
  d.sla_compliant,
  d.has_issues,
  d.issue_type,
  d.created_at,
  d.updated_at
FROM deliveries d
WHERE d.rider_id = 'PEGA_AQUI_EL_RIDER_ID'
ORDER BY COALESCE(d.updated_at, d.created_at) DESC;
"
```

## 7. Pedidos y entregas juntos

Sirve para detectar si existe pedido sin entrega o entrega con rider distinto.

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  o.id AS order_id,
  o.external_id,
  o.status AS order_status,
  o.assigned_rider_id,
  o.customer_name,
  o.total,
  o.delivery_fee,
  d.id AS delivery_id,
  d.status AS delivery_status,
  d.rider_id AS delivery_rider_id,
  d.started_at,
  d.completed_at,
  o.created_at AS order_created_at,
  d.created_at AS delivery_created_at
FROM orders o
LEFT JOIN deliveries d ON d.order_id = o.id
WHERE o.assigned_rider_id = 'PEGA_AQUI_EL_RIDER_ID'
   OR d.rider_id = 'PEGA_AQUI_EL_RIDER_ID'
ORDER BY GREATEST(
  COALESCE(o.updated_at, o.created_at),
  COALESCE(d.updated_at, d.created_at),
  COALESCE(o.created_at, d.created_at)
) DESC;
"
```

## 8. Movimientos financieros del rider

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  f.id,
  f.rider_id,
  f.shift_id,
  f.transaction_type,
  f.amount,
  f.balance_before,
  f.balance_after,
  f.status,
  f.description,
  f.reference_id,
  f.source_type,
  f.source_id,
  f.idempotency_key,
  f.created_by_user_id,
  f.created_at,
  f.updated_at
FROM financials f
WHERE f.rider_id = 'PEGA_AQUI_EL_RIDER_ID'
ORDER BY f.created_at DESC;
"
```

## 9. Resumen de ganancias por tipo y estado

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  f.transaction_type,
  f.status,
  COUNT(*) AS movimientos,
  SUM(f.amount) AS total
FROM financials f
WHERE f.rider_id = 'PEGA_AQUI_EL_RIDER_ID'
GROUP BY f.transaction_type, f.status
ORDER BY f.transaction_type, f.status;
"
```

## 10. Balance disponible calculado manualmente

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
WITH earnings AS (
  SELECT COALESCE(SUM(amount), 0) AS total_earned
  FROM financials
  WHERE rider_id = 'PEGA_AQUI_EL_RIDER_ID'
    AND transaction_type IN ('PAGO_ENTREGA', 'BONO')
    AND status = 'PROCESADO'
),
pending_payouts AS (
  SELECT COALESCE(SUM(amount), 0) AS pending
  FROM payouts
  WHERE rider_id = 'PEGA_AQUI_EL_RIDER_ID'
    AND status = 'PENDIENTE'
),
processed_payouts AS (
  SELECT COALESCE(SUM(amount), 0) AS processed
  FROM payouts
  WHERE rider_id = 'PEGA_AQUI_EL_RIDER_ID'
    AND status IN ('APROBADO', 'PROCESANDO', 'PAGADO')
)
SELECT
  earnings.total_earned,
  pending_payouts.pending,
  processed_payouts.processed,
  earnings.total_earned - pending_payouts.pending - processed_payouts.processed AS available
FROM earnings, pending_payouts, processed_payouts;
"
```

## 11. Retiros del rider

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  p.id,
  p.rider_id,
  p.amount,
  p.status,
  p.method,
  p.bank_account_last4,
  p.reference_code,
  p.rejection_reason,
  p.idempotency_key,
  p.balance_before,
  p.balance_after,
  p.requested_by_user_id,
  p.processed_by_user_id,
  p.requested_at,
  p.processed_at,
  p.updated_at
FROM payouts p
WHERE p.rider_id = 'PEGA_AQUI_EL_RIDER_ID'
ORDER BY p.requested_at DESC;
"
```

## 12. Historial de estado de retiros

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  h.id,
  h.payout_id,
  p.rider_id,
  p.amount,
  h.old_status,
  h.new_status,
  h.reason,
  h.created_by_user_id,
  h.created_at
FROM payout_status_history h
JOIN payouts p ON p.id = h.payout_id
WHERE p.rider_id = 'PEGA_AQUI_EL_RIDER_ID'
ORDER BY h.created_at DESC;
"
```

## 13. Turnos del rider

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  s.id,
  s.rider_id,
  s.shift_date,
  s.start_time,
  s.end_time,
  s.check_in_at,
  s.check_out_at,
  s.status,
  s.total_deliveries,
  s.completed_deliveries,
  s.total_earnings,
  s.notes,
  s.cancellation_reason,
  s.created_at,
  s.updated_at
FROM shifts s
WHERE s.rider_id = 'PEGA_AQUI_EL_RIDER_ID'
ORDER BY s.shift_date DESC, s.start_time DESC;
"
```

## 14. Productividad resumida por rider

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  r.id AS rider_id,
  u.email,
  COUNT(DISTINCT o.id) AS orders_assigned,
  COUNT(DISTINCT d.id) AS deliveries_assigned,
  COUNT(DISTINCT CASE WHEN o.status = 'ENTREGADO' THEN o.id END) AS orders_delivered,
  COUNT(DISTINCT CASE WHEN d.status = 'COMPLETADA' THEN d.id END) AS deliveries_completed,
  COALESCE(SUM(CASE WHEN f.transaction_type IN ('PAGO_ENTREGA', 'BONO') AND f.status = 'PROCESADO' THEN f.amount ELSE 0 END), 0) AS total_earned,
  COALESCE(SUM(CASE WHEN p.status = 'PENDIENTE' THEN p.amount ELSE 0 END), 0) AS pending_payouts
FROM riders r
JOIN users u ON u.id = r.user_id
LEFT JOIN orders o ON o.assigned_rider_id = r.id
LEFT JOIN deliveries d ON d.rider_id = r.id
LEFT JOIN financials f ON f.rider_id = r.id
LEFT JOIN payouts p ON p.rider_id = r.id
WHERE r.id = 'PEGA_AQUI_EL_RIDER_ID'
GROUP BY r.id, u.email;
"
```

## 15. Notificaciones del usuario rider

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  n.id,
  n.user_id,
  u.email,
  n.title,
  n.message,
  n.type,
  n.priority,
  n.status,
  n.read_at,
  n.created_at
FROM notifications n
JOIN users u ON u.id = n.user_id
JOIN riders r ON r.user_id = u.id
WHERE r.id = 'PEGA_AQUI_EL_RIDER_ID'
ORDER BY n.created_at DESC;
"
```

## 16. Alertas relacionadas con rider

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  a.id,
  a.title,
  a.message,
  a.type,
  a.severity,
  a.status,
  a.rider_id,
  a.order_id,
  a.delivery_id,
  a.created_at,
  a.resolved_at
FROM alerts a
WHERE a.rider_id = 'PEGA_AQUI_EL_RIDER_ID'
ORDER BY a.created_at DESC;
"
```

## 17. Riders sin usuario válido

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  r.id AS rider_id,
  r.user_id,
  r.status,
  r.created_at
FROM riders r
LEFT JOIN users u ON u.id = r.user_id
WHERE u.id IS NULL;
"
```

## 18. Usuarios repartidores sin fila en riders

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  u.id,
  u.email,
  u.role,
  u.is_active,
  u.created_at
FROM users u
LEFT JOIN riders r ON r.user_id = u.id
WHERE u.role = 'REPARTIDOR'
  AND r.id IS NULL;
"
```

## 19. Pedidos asignados a riders inexistentes

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  o.id,
  o.external_id,
  o.assigned_rider_id,
  o.status,
  o.created_at
FROM orders o
LEFT JOIN riders r ON r.id = o.assigned_rider_id
WHERE o.assigned_rider_id IS NOT NULL
  AND r.id IS NULL;
"
```

## 20. Entregas asignadas a riders inexistentes

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  d.id,
  d.order_id,
  d.rider_id,
  d.status,
  d.created_at
FROM deliveries d
LEFT JOIN riders r ON r.id = d.rider_id
WHERE d.rider_id IS NOT NULL
  AND r.id IS NULL;
"
```

## 21. Entregas cuyo rider no coincide con el pedido

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  o.id AS order_id,
  o.external_id,
  o.assigned_rider_id AS order_rider_id,
  d.rider_id AS delivery_rider_id,
  o.status AS order_status,
  d.status AS delivery_status,
  o.created_at AS order_created_at,
  d.created_at AS delivery_created_at
FROM orders o
JOIN deliveries d ON d.order_id = o.id
WHERE o.assigned_rider_id IS DISTINCT FROM d.rider_id;
"
```

## 22. Movimientos financieros sin rider válido

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  f.id,
  f.rider_id,
  f.transaction_type,
  f.amount,
  f.status,
  f.created_at
FROM financials f
LEFT JOIN riders r ON r.id = f.rider_id
WHERE r.id IS NULL;
"
```

## 23. Retiros sin rider válido

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  p.id,
  p.rider_id,
  p.amount,
  p.status,
  p.requested_at
FROM payouts p
LEFT JOIN riders r ON r.id = p.rider_id
WHERE r.id IS NULL;
"
```

## 24. Órdenes entregadas sin movimiento financiero

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  o.id AS order_id,
  o.external_id,
  o.assigned_rider_id,
  o.status,
  o.total,
  o.delivery_fee,
  o.delivered_at,
  f.id AS financial_id
FROM orders o
LEFT JOIN financials f
  ON f.rider_id = o.assigned_rider_id
 AND (
      f.source_id = o.id::text
      OR f.reference_id = o.id::text
      OR f.reference_id = o.external_id
 )
WHERE o.status = 'ENTREGADO'
  AND o.assigned_rider_id IS NOT NULL
  AND f.id IS NULL
ORDER BY o.delivered_at DESC NULLS LAST;
"
```

## 25. Monitorear cambios generales cada 2 segundos

```bash
watch -n 2 "docker compose exec -T db psql -U admin -d delivery360 -c \"
SELECT
  'riders' AS table_name, COUNT(*) AS rows, MAX(updated_at) AS last_update FROM riders
UNION ALL SELECT 'orders', COUNT(*), MAX(updated_at) FROM orders
UNION ALL SELECT 'deliveries', COUNT(*), MAX(updated_at) FROM deliveries
UNION ALL SELECT 'financials', COUNT(*), MAX(updated_at) FROM financials
UNION ALL SELECT 'payouts', COUNT(*), MAX(updated_at) FROM payouts
UNION ALL SELECT 'shifts', COUNT(*), MAX(updated_at) FROM shifts;
\""
```

## 26. Monitorear perfil de un rider cada 2 segundos

```bash
watch -n 2 "docker compose exec -T db psql -U admin -d delivery360 -c \"
SELECT
  r.id,
  u.email,
  r.status,
  r.is_online,
  r.current_order_id,
  r.last_lat,
  r.last_lng,
  r.last_location_at,
  r.updated_at
FROM riders r
JOIN users u ON u.id = r.user_id
WHERE r.id = 'PEGA_AQUI_EL_RIDER_ID';
\""
```

## 27. Monitorear pedidos y entregas del rider cada 2 segundos

```bash
watch -n 2 "docker compose exec -T db psql -U admin -d delivery360 -c \"
SELECT
  o.external_id,
  o.status AS order_status,
  d.status AS delivery_status,
  o.total,
  o.delivery_fee,
  o.updated_at AS order_updated,
  d.updated_at AS delivery_updated
FROM orders o
LEFT JOIN deliveries d ON d.order_id = o.id
WHERE o.assigned_rider_id = 'PEGA_AQUI_EL_RIDER_ID'
   OR d.rider_id = 'PEGA_AQUI_EL_RIDER_ID'
ORDER BY GREATEST(
  COALESCE(o.updated_at, o.created_at),
  COALESCE(d.updated_at, d.created_at),
  COALESCE(o.created_at, d.created_at)
) DESC
LIMIT 10;
\""
```

## 28. Monitorear ganancias y retiros cada 2 segundos

```bash
watch -n 2 "docker compose exec -T db psql -U admin -d delivery360 -c \"
WITH earnings AS (
  SELECT COALESCE(SUM(amount), 0) AS total_earned
  FROM financials
  WHERE rider_id = 'PEGA_AQUI_EL_RIDER_ID'
    AND transaction_type IN ('PAGO_ENTREGA', 'BONO')
    AND status = 'PROCESADO'
),
pending_payouts AS (
  SELECT COALESCE(SUM(amount), 0) AS pending
  FROM payouts
  WHERE rider_id = 'PEGA_AQUI_EL_RIDER_ID'
    AND status = 'PENDIENTE'
),
processed_payouts AS (
  SELECT COALESCE(SUM(amount), 0) AS processed
  FROM payouts
  WHERE rider_id = 'PEGA_AQUI_EL_RIDER_ID'
    AND status IN ('APROBADO', 'PROCESANDO', 'PAGADO')
)
SELECT
  earnings.total_earned,
  pending_payouts.pending,
  processed_payouts.processed,
  earnings.total_earned - pending_payouts.pending - processed_payouts.processed AS available
FROM earnings, pending_payouts, processed_payouts;
\""
```

## 29. Diagnóstico rápido: puede ver módulo rider

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  u.id AS user_id,
  u.email,
  u.role,
  u.is_active,
  r.id AS rider_id,
  r.status AS rider_status,
  r.is_online
FROM users u
LEFT JOIN riders r ON r.user_id = u.id
WHERE lower(u.email) = lower('rider@delivery360.com');
"
```

Si `rider_id` sale `NULL`, el usuario tiene rol rider pero no tiene perfil rider asociado.

## 30. Diagnóstico rápido: por qué no aparecen ganancias

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  COUNT(*) AS total_financial_rows,
  COUNT(*) FILTER (WHERE status = 'PROCESADO') AS processed_rows,
  COUNT(*) FILTER (WHERE transaction_type IN ('PAGO_ENTREGA', 'BONO')) AS earning_rows,
  COALESCE(SUM(amount) FILTER (
    WHERE status = 'PROCESADO'
      AND transaction_type IN ('PAGO_ENTREGA', 'BONO')
  ), 0) AS visible_earnings
FROM financials
WHERE rider_id = 'PEGA_AQUI_EL_RIDER_ID';
"
```

## 31. Diagnóstico rápido: por qué no aparecen pedidos

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  COUNT(*) AS assigned_orders,
  COUNT(*) FILTER (WHERE status = 'PENDIENTE') AS pending,
  COUNT(*) FILTER (WHERE status = 'ASIGNADO') AS assigned,
  COUNT(*) FILTER (WHERE status = 'EN_CAMINO') AS in_progress,
  COUNT(*) FILTER (WHERE status = 'ENTREGADO') AS delivered,
  COUNT(*) FILTER (WHERE status = 'CANCELADO') AS cancelled
FROM orders
WHERE assigned_rider_id = 'PEGA_AQUI_EL_RIDER_ID';
"
```

## 32. Diagnóstico rápido: por qué no aparecen entregas

```bash
docker compose exec -T db psql -U admin -d delivery360 -c "
SELECT
  COUNT(*) AS deliveries,
  COUNT(*) FILTER (WHERE status = 'PENDIENTE') AS pending,
  COUNT(*) FILTER (WHERE status = 'ASIGNADA') AS assigned,
  COUNT(*) FILTER (WHERE status = 'EN_CURSO') AS in_progress,
  COUNT(*) FILTER (WHERE status = 'COMPLETADA') AS completed,
  COUNT(*) FILTER (WHERE status = 'FALLIDA') AS failed
FROM deliveries
WHERE rider_id = 'PEGA_AQUI_EL_RIDER_ID';
"
```

## Orden recomendado de uso

1. Buscar el rider por email.
2. Copiar el `rider_id`.
3. Revisar perfil, pedidos, entregas, finanzas y retiros.
4. Ejecutar las consultas de inconsistencias.
5. Usar los comandos `watch` mientras se hacen cambios desde el frontend.
