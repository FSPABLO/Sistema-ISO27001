-- I10_enmascarar_clon.sql - Controles A.8.11 (enmascaramiento) y A.8.33 (informacion de prueba)
-- Sustituye de forma irreversible los datos personales del clon de desarrollo por valores sinteticos
-- que conservan el formato (pruebas siguen funcionando) pero no se relacionan con produccion.
@comun/inicio.sql
PROMPT === I10 Enmascaramiento de SEGCONF_DEV.CLIENTES ===
UPDATE segconf_dev.clientes SET
  cedula   = '9-' || LPAD(id_cliente, 4, '0') || '-' || LPAD(MOD(id_cliente * 7919, 10000), 4, '0'),
  nombre   = 'Cliente Prueba ' || id_cliente,
  email    = 'cliente' || id_cliente || '@ejemplo.invalid',
  telefono = '0000-' || LPAD(id_cliente, 4, '0'),
  tarjeta  = '0000-0000-0000-' || LPAD(id_cliente, 4, '0'),
  salario  = 300000 + MOD(id_cliente * 104729, 1500000) + 0.5;
COMMIT;
SELECT id_cliente, cedula, nombre, email, telefono, tarjeta, salario FROM segconf_dev.clientes WHERE id_cliente <= 3 ORDER BY 1;
@comun/fin.sql
