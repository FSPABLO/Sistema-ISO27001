-- I06_vpd.sql - Control A.8.3 (restriccion de acceso a la informacion): Virtual Private Database
-- Cada usuario de aplicacion solo ve las provincias asignadas en SEGCONF.ACCESO_REGION.
@comun/inicio.sql
PROMPT === I06 VPD sobre SEGCONF.CLIENTES ===
CREATE OR REPLACE PACKAGE segconf.pkg_seguridad AUTHID DEFINER AS
  FUNCTION pred_clientes(p_esquema IN VARCHAR2, p_objeto IN VARCHAR2) RETURN VARCHAR2;
END pkg_seguridad;
/
CREATE OR REPLACE PACKAGE BODY segconf.pkg_seguridad AS
  FUNCTION pred_clientes(p_esquema IN VARCHAR2, p_objeto IN VARCHAR2) RETURN VARCHAR2 IS
    v_usuario VARCHAR2(128) := SYS_CONTEXT('USERENV', 'SESSION_USER');
    v_lista   VARCHAR2(4000);
  BEGIN
    IF v_usuario = 'SEGCONF' THEN
      RETURN NULL;                                   -- propietario: sin restriccion
    END IF;
    SELECT LISTAGG(DBMS_ASSERT.ENQUOTE_LITERAL(provincia), ',') WITHIN GROUP (ORDER BY provincia)
      INTO v_lista FROM acceso_region WHERE usuario = v_usuario;
    IF v_lista IS NULL THEN
      RETURN '1 = 0';                                -- sin asignacion: no ve filas
    END IF;
    RETURN 'provincia IN (' || v_lista || ')';
  END pred_clientes;
END pkg_seguridad;
/
SHOW ERRORS PACKAGE BODY segconf.pkg_seguridad
BEGIN
  FOR p IN (SELECT policy_name FROM dba_policies WHERE object_owner = 'SEGCONF' AND object_name = 'CLIENTES') LOOP
    DBMS_RLS.DROP_POLICY(object_schema => 'SEGCONF', object_name => 'CLIENTES', policy_name => p.policy_name);
  END LOOP;
  DBMS_RLS.ADD_POLICY(
    object_schema   => 'SEGCONF',
    object_name     => 'CLIENTES',
    policy_name     => 'POL_VPD_CLIENTES',
    function_schema => 'SEGCONF',
    policy_function => 'PKG_SEGURIDAD.PRED_CLIENTES',
    statement_types => 'SELECT,INSERT,UPDATE,DELETE',
    update_check    => TRUE,
    policy_type     => DBMS_RLS.CONTEXT_SENSITIVE);
END;
/
COLUMN policy_name FORMAT A20
COLUMN package FORMAT A15
COLUMN function FORMAT A15
SELECT policy_name, package, function, sel, ins, upd, del, enable FROM dba_policies WHERE object_owner = 'SEGCONF';
@comun/fin.sql
