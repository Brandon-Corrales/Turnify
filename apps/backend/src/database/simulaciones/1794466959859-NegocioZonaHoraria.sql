-- Simulación de SOLO LECTURA de NegocioZonaHoraria1794466959859.
--   npm run migration:simular -- 1794466959859-NegocioZonaHoraria.sql
-- La migración solo agrega una columna con valor por defecto: no modifica ni
-- borra filas. Esto muestra a cuántos negocios se les asignará el valor
-- por defecto y confirma que la columna todavía no existe.

SELECT count(*) AS negocios_que_quedan_en_america_costa_rica,
       count(*) FILTER (WHERE eliminado_en IS NOT NULL) AS de_ellos_desactivados
FROM negocios;

SELECT count(*) AS columna_ya_existe
FROM information_schema.columns
WHERE table_name = 'negocios' AND column_name = 'zona_horaria';
