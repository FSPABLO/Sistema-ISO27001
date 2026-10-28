-- V07_auditoria.sql - PB-07: auditoria unificada del acceso a datos confidenciales (A.8.15)
@comun/inicio.sql
PROMPT === V07 Auditoria unificada ===
COLUMN policy_name FORMAT A20
COLUMN enabled_option FORMAT A15
COLUMN entity_name FORMAT A12
SELECT policy_name, enabled_option, entity_name, success, failure FROM audit_unified_enabled_policies
 WHERE policy_name LIKE 'POL_AUD%' ORDER BY 1;
COLUMN inicio NEW_VALUE v_inicio NOPRINT
SELECT TO_CHAR(SYSTIMESTAMP - INTERVAL '2' SECOND, 'YYYY-MM-DD HH24:MI:SS.FF') inicio FROM dual;
VARIABLE v_error VARCHAR2(300)
PROMPT -- Consulta de prueba como APP_CONSULTA
CONNECT app_consulta/"&PWD_CONSULTA"@&CON_PDB
DECLARE n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM segconf.clientes;
EXCEPTION WHEN OTHERS THEN :v_error := SQLERRM;
END;
/
@comun/volver_sys.sql
COLUMN event_timestamp FORMAT A30
COLUMN dbusername FORMAT A14
COLUMN action_name FORMAT A10
COLUMN unified_audit_policies FORMAT A20
SELECT event_timestamp, dbusername, action_name, object_schema || '.' || object_name objeto, unified_audit_policies
  FROM unified_audit_trail
 WHERE object_schema = 'SEGCONF' AND object_name = 'CLIENTES'
   AND event_timestamp >= TO_TIMESTAMP('&v_inicio', 'YYYY-MM-DD HH24:MI:SS.FF')
 ORDER BY event_timestamp;
DECLARE
  v_pol NUMBER; v_reg NUMBER;
BEGIN
  IF NOT segconf.pkg_verif.opcion('Unified Auditing') THEN
    segconf.pkg_verif.no_dispon('PB-07', 'V$OPTION: Unified Auditing = FALSE');
    RETURN;
  END IF;
  SELECT COUNT(*) INTO v_pol FROM audit_unified_enabled_policies e
   WHERE EXISTS (SELECT 1 FROM audit_unified_policies p
                  WHERE p.policy_name = e.policy_name AND p.object_schema = 'SEGCONF'
                    AND p.object_name = 'CLIENTES' AND p.audit_option = 'SELECT');
  segconf.pkg_verif.linea('PB-07a', v_pol > 0, 'Politicas unificadas habilitadas que auditan SELECT sobre SEGCONF.CLIENTES: ' || v_pol);
  SELECT COUNT(*) INTO v_reg FROM unified_audit_trail
   WHERE dbusername = 'APP_CONSULTA' AND object_schema = 'SEGCONF' AND object_name = 'CLIENTES'
     AND action_name = 'SELECT'
     AND event_timestamp >= TO_TIMESTAMP('&v_inicio', 'YYYY-MM-DD HH24:MI:SS.FF');
  segconf.pkg_verif.linea('PB-07b', v_reg > 0, 'Registros de auditoria del SELECT de prueba de APP_CONSULTA: ' || v_reg
    || CASE WHEN :v_error IS NOT NULL THEN ' (error en consulta: ' || :v_error || ')' END);
END;
/
@comun/fin.sql
