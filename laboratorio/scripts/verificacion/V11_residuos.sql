-- V11_residuos.sql - PB-11: eliminacion de informacion residual (A.8.10)
@comun/inicio.sql
PROMPT === V11 Papelera y copias residuales ===
COLUMN owner FORMAT A12
COLUMN original_name FORMAT A30
SELECT owner, original_name, object_name, droptime FROM dba_recyclebin WHERE owner IN ('SEGCONF','SEGCONF_DEV');
DECLARE
  v_n NUMBER; v_lista VARCHAR2(4000);
BEGIN
  SELECT COUNT(*), LISTAGG(owner || '.' || original_name, ',') WITHIN GROUP (ORDER BY 1) INTO v_n, v_lista
    FROM dba_recyclebin WHERE owner IN ('SEGCONF','SEGCONF_DEV');
  segconf.pkg_verif.linea('PB-11a', v_n = 0, 'Objetos en la papelera de SEGCONF/SEGCONF_DEV: ' || v_n
    || CASE WHEN v_n > 0 THEN ' (' || v_lista || ')' END);
  SELECT COUNT(*), LISTAGG(owner || '.' || table_name, ',') WITHIN GROUP (ORDER BY 1) INTO v_n, v_lista
    FROM dba_tables
   WHERE owner IN ('SEGCONF','SEGCONF_DEV')
     AND (table_name LIKE '%TMP%' OR table_name LIKE '%BAK%' OR table_name LIKE '%RESPALDO%' OR table_name LIKE '%COPIA%');
  segconf.pkg_verif.linea('PB-11b', v_n = 0, 'Copias temporales de datos confidenciales: ' || v_n
    || CASE WHEN v_n > 0 THEN ' (' || v_lista || ')' END);
END;
/
@comun/fin.sql
