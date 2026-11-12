-- Simulación de SOLO LECTURA de NegocioMoneda1794469437426.
--   npm run migration:simular -- 1794469437426-NegocioMoneda.sql
-- Solo agrega una columna con valor por defecto 'CRC': no modifica ni borra
-- filas, y los precios guardados no cambian.

SELECT count(*) AS negocios_que_quedan_en_crc FROM negocios;

SELECT count(*) AS servicios_cuyo_precio_no_cambia,
       count(*) FILTER (WHERE precio <> round(precio)) AS de_ellos_con_centimos
FROM servicios;

SELECT count(*) AS columna_ya_existe
FROM information_schema.columns
WHERE table_name = 'negocios' AND column_name = 'moneda';
