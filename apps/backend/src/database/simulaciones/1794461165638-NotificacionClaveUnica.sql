-- Simulación de SOLO LECTURA de la migración NotificacionClaveUnica1794461165638.
-- No modifica nada: calcula la hora de la cita con un JOIN en vez de escribir
-- la columna nueva. Ejecutar con:  npm run migration:simular -- 1794461165638-NotificacionClaveUnica.sql
-- (el script abre una transacción READ ONLY y la revierte al final).

-- 1. Filas sin reserva de la que tomar la hora (la migración falla si hay alguna).
SELECT count(*) AS filas_sin_reserva
FROM notificaciones n LEFT JOIN reservas r ON r.id_reserva = n.id_reserva
WHERE r.id_reserva IS NULL;

-- 2. Resumen: grupos duplicados, filas en esos grupos y filas que se eliminarían.
WITH clasificadas AS (
  SELECT n.id_notificacion, n.tipo,
         row_number() OVER (
           PARTITION BY n.id_reserva, n.tipo, r.fecha_hora_inicio
           ORDER BY (n.estado IN ('enviada', 'entregada')) DESC, n.creado_en ASC, n.id_notificacion ASC
         ) AS posicion,
         count(*) OVER (PARTITION BY n.id_reserva, n.tipo, r.fecha_hora_inicio) AS tamano_grupo
  FROM notificaciones n JOIN reservas r ON r.id_reserva = n.id_reserva
)
SELECT tipo,
       count(*) FILTER (WHERE tamano_grupo > 1 AND posicion = 1) AS grupos_duplicados,
       count(*) FILTER (WHERE tamano_grupo > 1) AS filas_en_grupos,
       count(*) FILTER (WHERE posicion > 1) AS filas_a_eliminar
FROM clasificadas GROUP BY tipo ORDER BY tipo;

-- 3. Ejemplos (hasta 5 grupos): qué fila se conserva y cuáles se eliminan.
WITH clasificadas AS (
  SELECT n.id_reserva, n.id_notificacion, n.tipo, n.estado, n.creado_en,
         row_number() OVER (
           PARTITION BY n.id_reserva, n.tipo, r.fecha_hora_inicio
           ORDER BY (n.estado IN ('enviada', 'entregada')) DESC, n.creado_en ASC, n.id_notificacion ASC
         ) AS posicion,
         count(*) OVER (PARTITION BY n.id_reserva, n.tipo, r.fecha_hora_inicio) AS tamano_grupo
  FROM notificaciones n JOIN reservas r ON r.id_reserva = n.id_reserva
),
grupos AS (
  SELECT DISTINCT id_reserva, tipo FROM clasificadas WHERE tamano_grupo > 1 ORDER BY id_reserva LIMIT 5
)
SELECT left(c.id_reserva::text, 8) AS reserva, c.tipo, c.estado,
       to_char(c.creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS creado_utc,
       CASE WHEN c.posicion = 1 THEN 'se conserva' ELSE 'se elimina' END AS accion
FROM clasificadas c JOIN grupos g USING (id_reserva, tipo)
ORDER BY c.id_reserva, c.tipo, c.posicion;
