-- I07_auditoria.sql - Control A.8.15 (registro): auditoria unificada
@comun/inicio.sql
PROMPT === I07 Auditoria unificada ===
BEGIN
  FOR p IN (SELECT DISTINCT policy_name FROM audit_unified_policies
             WHERE policy_name IN ('POL_AUD_CLIENTES','POL_AUD_ADMIN')) LOOP
    BEGIN EXECUTE IMMEDIATE 'NOAUDIT POLICY ' || p.policy_name; EXCEPTION WHEN OTHERS THEN NULL; END;
    EXECUTE IMMEDIATE 'DROP AUDIT POLICY ' || p.policy_name;
  END LOOP;
END;
/
-- Acceso a los datos confidenciales (produccion y clon)
CREATE AUDIT POLICY pol_aud_clientes
  ACTIONS SELECT ON segconf.clientes, INSERT ON segconf.clientes,
          UPDATE ON segconf.clientes, DELETE ON segconf.clientes,
          SELECT ON segconf_dev.clientes;
AUDIT POLICY pol_aud_clientes;
-- Uso de privilegios que eluden los controles y administracion de cuentas
CREATE AUDIT POLICY pol_aud_admin
  PRIVILEGES SELECT ANY TABLE, EXEMPT REDACTION POLICY, EXEMPT ACCESS POLICY
  ACTIONS CREATE USER, ALTER USER, DROP USER, CREATE ROLE, DROP ROLE, GRANT, REVOKE, ALTER PROFILE;
AUDIT POLICY pol_aud_admin;
-- Separacion de funciones: el auditor solo lee la traza
GRANT audit_viewer TO app_auditor;
COLUMN policy_name FORMAT A20
COLUMN enabled_option FORMAT A15
COLUMN entity_name FORMAT A12
SELECT policy_name, enabled_option, entity_name, success, failure FROM audit_unified_enabled_policies
 WHERE policy_name LIKE 'POL_AUD%';
@comun/fin.sql
