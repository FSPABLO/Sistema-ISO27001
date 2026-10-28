-- V00_entorno.sql - PB-00: entorno de pruebas disponible (version, PDB, datos)
@comun/inicio.sql
PROMPT === V00 Estado del entorno ===
COLUMN banner_full FORMAT A90
SELECT banner_full FROM v$version;
COLUMN name FORMAT A12
SELECT name, open_mode FROM v$pdbs;
DECLARE
  v_open VARCHAR2(20); v_prod NUMBER; v_dev NUMBER;
BEGIN
  SELECT open_mode INTO v_open FROM v$pdbs WHERE name = '&PDB';
  SELECT COUNT(*) INTO v_prod FROM segconf.clientes;
  SELECT COUNT(*) INTO v_dev  FROM segconf_dev.clientes;
  segconf.pkg_verif.linea('PB-00', v_open = 'READ WRITE' AND v_prod = 60 AND v_dev = 60,
    '&PDB ' || v_open || '; SEGCONF.CLIENTES=' || v_prod || ' filas; SEGCONF_DEV.CLIENTES=' || v_dev || ' filas');
END;
/
@comun/fin.sql
