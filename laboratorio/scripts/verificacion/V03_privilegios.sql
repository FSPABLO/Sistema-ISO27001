-- V03_privilegios.sql - PB-03: minimo privilegio (A.5.15, A.8.2)
@comun/inicio.sql
PROMPT === V03 Minimo privilegio ===
DECLARE
  v_n NUMBER; v_lista VARCHAR2(4000);
BEGIN
  -- a) SELECT ANY TABLE en cuentas/roles no mantenidos por Oracle
  SELECT COUNT(*), LISTAGG(grantee, ',') WITHIN GROUP (ORDER BY grantee) INTO v_n, v_lista
    FROM dba_sys_privs
   WHERE privilege = 'SELECT ANY TABLE'
     AND (grantee IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
       OR grantee IN (SELECT role FROM dba_roles WHERE oracle_maintained = 'N'));
  segconf.pkg_verif.linea('PB-03a', v_n = 0, 'Usuarios/roles no administrativos con SELECT ANY TABLE: ' || v_n
    || CASE WHEN v_n > 0 THEN ' (' || v_lista || ')' END);
  -- b) Paquetes UTL_* ejecutables por PUBLIC
  SELECT COUNT(*), LISTAGG(table_name, ',') WITHIN GROUP (ORDER BY table_name) INTO v_n, v_lista
    FROM dba_tab_privs
   WHERE grantee = 'PUBLIC' AND owner = 'SYS' AND privilege = 'EXECUTE'
     AND table_name IN ('UTL_FILE','UTL_HTTP','UTL_TCP','UTL_SMTP','UTL_INADDR');
  segconf.pkg_verif.linea('PB-03b', v_n = 0, 'Paquetes UTL_* con EXECUTE para PUBLIC: ' || v_n
    || CASE WHEN v_n > 0 THEN ' (' || v_lista || ')' END);
  -- c) Acceso a SEGCONF.CLIENTES solo por roles (sin permisos directos a usuarios)
  SELECT COUNT(*), LISTAGG(grantee || ':' || privilege, ',') WITHIN GROUP (ORDER BY grantee) INTO v_n, v_lista
    FROM dba_tab_privs
   WHERE owner = 'SEGCONF' AND table_name = 'CLIENTES'
     AND grantee IN (SELECT username FROM dba_users);
  segconf.pkg_verif.linea('PB-03c', v_n = 0, 'Permisos directos a usuarios sobre SEGCONF.CLIENTES: ' || v_n
    || CASE WHEN v_n > 0 THEN ' (' || v_lista || ')' END);
END;
/
@comun/fin.sql
