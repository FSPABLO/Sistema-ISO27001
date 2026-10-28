-- I11_purga_residuos.sql - Control A.8.10 (eliminacion de informacion)
-- Elimina copias temporales de datos confidenciales y vacia la papelera de los esquemas del proyecto.
@comun/inicio.sql
PROMPT === I11 Purga de residuos ===
BEGIN
  FOR t IN (SELECT owner, table_name FROM dba_tables
             WHERE owner IN ('SEGCONF','SEGCONF_DEV')
               AND (table_name LIKE '%TMP%' OR table_name LIKE '%BAK%'
                 OR table_name LIKE '%RESPALDO%' OR table_name LIKE '%COPIA%')) LOOP
    EXECUTE IMMEDIATE 'DROP TABLE "' || t.owner || '"."' || t.table_name || '" PURGE';
    DBMS_OUTPUT.PUT_LINE('Eliminada (PURGE) ' || t.owner || '.' || t.table_name);
  END LOOP;
  FOR r IN (SELECT owner, object_name, original_name FROM dba_recyclebin
             WHERE owner IN ('SEGCONF','SEGCONF_DEV') AND type = 'TABLE') LOOP
    EXECUTE IMMEDIATE 'PURGE TABLE "' || r.owner || '"."' || r.object_name || '"';
    DBMS_OUTPUT.PUT_LINE('Purgada de la papelera ' || r.owner || '.' || r.original_name);
  END LOOP;
END;
/
SELECT COUNT(*) objetos_en_papelera FROM dba_recyclebin WHERE owner IN ('SEGCONF','SEGCONF_DEV');
@comun/fin.sql
