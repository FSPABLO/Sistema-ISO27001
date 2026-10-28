-- I03_minimo_privilegio.sql - Controles A.5.15 (control de acceso) y A.8.2 (privilegios)
@comun/inicio.sql
PROMPT === I03 Minimo privilegio ===
PROMPT -- 1. Revocar privilegios ANY y paquetes UTL_* de PUBLIC
PROMPT --    (antes, los esquemas de Oracle que usan UTL_* via PUBLIC reciben el permiso directo)
BEGIN
  FOR d IN (SELECT DISTINCT dp.owner, dp.referenced_name FROM dba_dependencies dp
             WHERE dp.referenced_owner = 'SYS'
               AND dp.referenced_name IN ('UTL_FILE','UTL_HTTP','UTL_TCP','UTL_SMTP','UTL_INADDR')
               AND dp.owner NOT IN ('SYS','PUBLIC')
               AND dp.owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'Y')
               AND NOT EXISTS (SELECT 1 FROM dba_tab_privs t
                                WHERE t.grantee = dp.owner AND t.owner = 'SYS'
                                  AND t.table_name = dp.referenced_name AND t.privilege = 'EXECUTE')) LOOP
    EXECUTE IMMEDIATE 'GRANT EXECUTE ON sys.' || d.referenced_name || ' TO "' || d.owner || '"';
    DBMS_OUTPUT.PUT_LINE('Permiso directo EXECUTE ON ' || d.referenced_name || ' a ' || d.owner);
  END LOOP;
END;
/
BEGIN
  FOR g IN (SELECT grantee FROM dba_sys_privs WHERE privilege = 'SELECT ANY TABLE'
              AND (grantee IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
                OR grantee IN (SELECT role FROM dba_roles WHERE oracle_maintained = 'N'))) LOOP
    EXECUTE IMMEDIATE 'REVOKE SELECT ANY TABLE FROM "' || g.grantee || '"';
    DBMS_OUTPUT.PUT_LINE('Revocado SELECT ANY TABLE de ' || g.grantee);
  END LOOP;
  FOR p IN (SELECT table_name FROM dba_tab_privs
             WHERE grantee = 'PUBLIC' AND owner = 'SYS' AND privilege = 'EXECUTE'
               AND table_name IN ('UTL_FILE','UTL_HTTP','UTL_TCP','UTL_SMTP','UTL_INADDR')) LOOP
    EXECUTE IMMEDIATE 'REVOKE EXECUTE ON sys.' || p.table_name || ' FROM PUBLIC';
    DBMS_OUTPUT.PUT_LINE('Revocado EXECUTE ON ' || p.table_name || ' de PUBLIC');
  END LOOP;
END;
/
PROMPT -- 2. Roles por funcion y reemplazo de permisos directos
DECLARE
  PROCEDURE crear_rol(p VARCHAR2) IS v NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v FROM dba_roles WHERE role = p;
    IF v = 0 THEN EXECUTE IMMEDIATE 'CREATE ROLE ' || p; END IF;
  END;
BEGIN
  crear_rol('ROL_CONSULTA_CLIENTES');
  crear_rol('ROL_SOPORTE_CLIENTES');
  crear_rol('ROL_REPORTES');
  EXECUTE IMMEDIATE 'GRANT SELECT ON segconf.clientes TO rol_consulta_clientes';
  EXECUTE IMMEDIATE 'GRANT SELECT ON segconf.clientes TO rol_soporte_clientes';
  EXECUTE IMMEDIATE 'GRANT SELECT ON segconf.v_clientes_resumen TO rol_reportes';
  EXECUTE IMMEDIATE 'GRANT rol_consulta_clientes TO app_consulta';
  EXECUTE IMMEDIATE 'GRANT rol_soporte_clientes TO app_soporte';
  EXECUTE IMMEDIATE 'GRANT rol_reportes TO app_reportes';
  FOR g IN (SELECT grantee, privilege FROM dba_tab_privs
             WHERE owner = 'SEGCONF' AND table_name = 'CLIENTES'
               AND grantee IN (SELECT username FROM dba_users)) LOOP
    EXECUTE IMMEDIATE 'REVOKE ' || g.privilege || ' ON segconf.clientes FROM "' || g.grantee || '"';
    DBMS_OUTPUT.PUT_LINE('Revocado permiso directo ' || g.privilege || ' de ' || g.grantee);
  END LOOP;
END;
/
COLUMN grantee FORMAT A24
COLUMN privilege FORMAT A10
COLUMN table_name FORMAT A20
SELECT grantee, table_name, privilege FROM dba_tab_privs WHERE owner = 'SEGCONF' ORDER BY 1, 2;
PROMPT -- 3. Recompilar objetos invalidados por las revocaciones
EXEC UTL_RECOMP.RECOMP_SERIAL()
COLUMN owner FORMAT A20
COLUMN object_name FORMAT A30
SELECT owner, object_name, object_type FROM dba_objects WHERE status = 'INVALID' ORDER BY 1, 2;
@comun/fin.sql
